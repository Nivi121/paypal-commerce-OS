# AegisCart AI — Autonomous Agentic Commerce & Verified PayPal Checkout OS

**AegisCart AI** is a full-stack Next.js (App Router) + TypeScript application that solves autonomous agentic commerce end-to-end:

**Search & Constraint Parsing → Hybrid Catalog Discovery → Spec Elimination → Multi-Axis Ranking → Human Approval Gate → PayPal Sandbox Checkout → Cryptographic Verification**

---

## Table of Contents

1. [How AI Is Used](#how-ai-is-used)
2. [How PayPal Is Used](#how-paypal-is-used)
3. [Sponsor & Technology Integrations](#sponsor--technology-integrations)
4. [4-Stage User Flow & 8-Step Agent Pipeline](#4-stage-user-flow--8-step-agent-pipeline)
5. [Local Setup Instructions](#local-setup-instructions)
6. [Demo Scenarios](#demo-scenarios)
7. [Project Structure](#project-structure)
8. [Deploying to Vercel](#deploying-to-vercel)
9. [License](#license)

---

## How AI Is Used

The AI agent orchestrator ([`src/app/api/agent/route.ts`](src/app/api/agent/route.ts)) drives constraint extraction, product filtering, and explainable ranking through structured tool definitions:

- **LLM Tool Calling (Gemini / OpenAI) + Deterministic Fallback:**
  - When `GEMINI_API_KEY` (`gemini-2.0-flash`) or `OPENAI_API_KEY` (`gpt-4o-mini`) is configured, the agent invokes structured function-calling with `extract_shopping_constraints` to parse natural-language requests (e.g., *"I need a laptop for programming under $900. I want at least 16 GB RAM, good battery life, and something that will last four years"*) into hard constraints and derived engineering rules (`min_battery_wh >= 50`, upgradeable DDR5 memory, non-ChromeOS for Docker/programming).
  - If no LLM key is set (or an upstream API times out), the built-in **Deterministic Agent Orchestrator** executes the exact same 8-step pipeline reliably out of the box.
- **Quantitative Multi-Axis Fit Score** ([`src/lib/scoring-engine.ts`](src/lib/scoring-engine.ts)):
  ```text
  FitScore = 0.35 × DevPerformance + 0.30 × FourYearLongevity + 0.20 × BatteryEndurance + 0.15 × BudgetEfficiency
  ```
- **Critical Security Boundary (No Autonomous Fund Capture):**
  - The AI agent has tool declarations for `extract_shopping_constraints`, `search_products`, `compare_products`, and `draft_checkout_intent`, and **has no tool for capturing PayPal funds**. Payment execution always requires explicit human interaction on the Checkout Authorization stage.

---

## How PayPal Is Used

PayPal powers both client-side checkout UX and server-side order creation, idempotency, and capture verification:

1. **Server-Side Orders v2 Integration** ([`src/lib/paypal-server.ts`](src/lib/paypal-server.ts)):
   - Fetches and caches OAuth2 bearer tokens via `POST /v1/oauth2/token` (`grant_type=client_credentials`).
   - Creates orders via `POST /v2/checkout/orders` with an idempotent `PayPal-Request-Id` header and embeds the SHA-256 cart lock in `purchase_units[0].custom_id`.
   - Captures authorized orders via `POST /v2/checkout/orders/{orderId}/capture`.
   - Includes an RFC-compliant **Zero-Config Sandbox Simulation** fallback when `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` are unset so the entire checkout flow can be tested immediately.
2. **Deterministic Spend Firewall** ([`src/app/api/paypal/create-order/route.ts`](src/app/api/paypal/create-order/route.ts)):
   - Before any PayPal order is created, server-side TypeScript code checks `product.price_usd > budget_cap`. If exceeded, it returns HTTP `403` with `SPEND_FIREWALL_BLOCKED` and refuses to call PayPal.
3. **SHA-256 Cart Integrity Verification** ([`src/app/api/paypal/capture-order/route.ts`](src/app/api/paypal/capture-order/route.ts)):
   - Re-computes the SHA-256 hash of `(sku + price + currency + budgetCap)` before capturing funds and verifies `status === "COMPLETED"` and exact captured amount parity.
4. **Client-Side PayPal Smart Payment Buttons** ([`src/components/CheckoutApprovalCard.tsx`](src/components/CheckoutApprovalCard.tsx)):
   - Integrates `@paypal/react-paypal-js` (`PayPalScriptProvider` + `PayPalButtons`) alongside an **Express Sandbox Checkout** option calling the exact same `/api/paypal/create-order` and `/api/paypal/capture-order` endpoints.

---

## Sponsor & Technology Integrations

| Integration / Technology | Role in AegisCart AI | Key File(s) |
| --- | --- | --- |
| **PayPal Orders v2 & React SDK** | OAuth2, order creation, idempotency (`PayPal-Request-Id`), capture verification, Smart Payment Buttons | [`src/lib/paypal-server.ts`](src/lib/paypal-server.ts), [`src/components/CheckoutApprovalCard.tsx`](src/components/CheckoutApprovalCard.tsx) |
| **AG Grid (`ag-grid-react` / `ag-grid-community`)** | Interactive sortable/filterable multi-product comparison matrix with custom Fit Score, RAM, battery, MIL-STD, and filter-note cells | [`src/components/ProductComparisonGrid.tsx`](src/components/ProductComparisonGrid.tsx) |
| **Channel3 REST API** | Live product discovery via `https://api.trychannel3.com/v1/search` merged and deduplicated by SKU with the 15-device authorized sandbox catalog | [`src/lib/channel3-client.ts`](src/lib/channel3-client.ts), [`src/lib/catalog-data.ts`](src/lib/catalog-data.ts) |
| **Gemini / OpenAI Tool Calling** | Natural-language constraint parsing with automatic deterministic fallback | [`src/app/api/agent/route.ts`](src/app/api/agent/route.ts) |
| **Next.js (App Router), React 19, TypeScript** | Full-stack serverless API routes and 4-stage URL-synced UI (`?step=search\|products\|checkout\|receipt`) | [`src/app/page.tsx`](src/app/page.tsx) |
| **Tailwind CSS v4 & Lucide React** | Glassmorphism + Neumorphism + Liquid Morphism neutral design system | [`src/app/globals.css`](src/app/globals.css) |

---

## 4-Stage User Flow & 8-Step Agent Pipeline

1. **Stage 1 — Search & Analysis:** Submit natural-language requirements or quick sample prompts, edit Spend Policy filters (`Budget Cap`, `Min RAM`, `Lifespan`, `Preferred Manufacturers`, `Required Specs`), and preview featured catalog hardware.
2. **Stage 2 — Product Selection:** Inspect the #1 ranked recommendation, compare qualifying alternatives, or switch to the full **AG Grid Comparison Table** showing all passed and rejected models.
3. **Stage 3 — Payment & Gateway:** Review the itemized order summary, Spend Policy Gate status, and SHA-256 cart lock; select **Express Sandbox Checkout**, **PayPal Sandbox Wallet**, or **Debit/Credit Card**.
4. **Stage 4 — Verified Receipt:** View PayPal Order ID, Capture ID, SHA-256 verification status, raw PayPal Orders v2 JSON payloads, and download the JSON audit receipt.

---

## Local Setup Instructions

### Prerequisites
- **Node.js 20+** and **npm**

### 1. Install Dependencies
```bash
git clone <your-repo-url>
cd paypal
npm install
```

### 2. Configure Environment Variables (Optional)
The application works out of the box in **Zero-Config Sandbox Simulation Mode**. To connect live Sandbox APIs, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

```env
# PayPal Sandbox / Live (https://developer.paypal.com)
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENV=sandbox
PAYPAL_MERCHANT_ID=

# Channel3 Product Discovery (https://trychannel3.com/developers)
CHANNEL3_API_KEY=

# Live LLM Tool Calling (optional — falls back to deterministic orchestrator)
GEMINI_API_KEY=
OPENAI_API_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 4. Production Build Check
```bash
npm run build
npm start
```

---

## Demo Scenarios

1. **Dev Laptop `≤ $900`:** Evaluates 15 laptops, disqualifies 11 models (soldered 8GB RAM traps, 41–42Wh batteries, ChromeOS, over-budget models), selects **Lenovo ThinkPad E14 Gen 6 ($789.00)** ($111.00 under budget), and completes PayPal checkout.
2. **Spend Policy Block (`$1,299 vs $900`):** Attempts a forced checkout on **Apple MacBook Pro 14 M3 ($1,299.00)** against a `$900.00` cap — blocked deterministically with `SPEND_FIREWALL_BLOCKED` (HTTP `403`).
3. **Workstation `≤ $1,150`:** Adjusts constraints to `32GB+ RAM` for local LLM/Docker workloads and selects **ASUS ProArt Studiobook 16 ($1,099.00)**.

---

## Project Structure

```text
src/
├── types/commerce.ts                  # Strict TypeScript interfaces
├── lib/
│   ├── catalog-data.ts                # 15-device authorized hardware catalog
│   ├── channel3-client.ts             # Channel3 API search + catalog merge
│   ├── scoring-engine.ts              # Constraint filter, Fit Score, Spend Firewall, SHA-256 lock
│   └── paypal-server.ts               # PayPal OAuth2, Orders v2 create/capture + sim fallback
├── app/
│   ├── api/
│   │   ├── agent/route.ts             # 8-step agent orchestrator (Gemini/OpenAI + deterministic)
│   │   ├── checkout-intent/route.ts   # Server-signed CheckoutIntent for selected candidate
│   │   └── paypal/
│   │       ├── create-order/route.ts  # Spend Firewall check + PayPal order creation
│   │       └── capture-order/route.ts # SHA-256 verification + PayPal order capture
│   ├── globals.css                    # Tailwind CSS v4 + Glass/Neo/Liquid design system
│   ├── layout.tsx                     # Root layout & metadata
│   └── page.tsx                       # 4-stage guided commerce flow
└── components/
    ├── Navbar.tsx                     # Header & environment modal trigger
    ├── PreferenceDrawer.tsx           # Two-way Spend Policy & constraint drawer
    ├── AgentStepper.tsx               # 8-step execution pipeline trace
    ├── ProductVisual.tsx              # Vector hardware visuals per brand/chassis
    ├── ProductComparisonGrid.tsx      # AG Grid multi-product comparison matrix
    ├── RecommendationHero.tsx         # Top match card, score breakdown & alternatives
    ├── CheckoutApprovalCard.tsx       # Payment method selector & PayPal gateway
    └── AuditTrailDrawer.tsx           # Receipt, execution trace & raw JSON inspector
```

---

## Deploying to Vercel

1. Push this repository to GitHub (`.gitignore` excludes `node_modules/`, `.next/`, and `.env.local`).
2. Import the repository in [Vercel](https://vercel.com) with the **Next.js** preset (`Build Command: npm run build`).
3. Add optional environment variables (`NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `CHANNEL3_API_KEY`, `GEMINI_API_KEY`) in **Project Settings → Environment Variables** if connecting live APIs.

---

## License

This project is licensed under the **MIT License** (an OSI-approved open-source license). See [LICENSE](LICENSE) for full terms.
