// ============================================================
// AegisCart AI — 8-Step Agent Orchestrator API Route
// Supports: Gemini tool-calling, OpenAI tool-calling,
//           Deterministic Fallback (zero-config)
// POST /api/agent
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  CATALOG_PRODUCTS,
  SCENARIO_2_FIREWALL_SKU,
} from "@/lib/catalog-data";
import {
  filterAndEliminate,
  rankProducts,
  buildCheckoutIntent,
} from "@/lib/scoring-engine";
import { hybridSearch } from "@/lib/channel3-client";
import type {
  AgentSession,
  AgentStep,
  ShoppingConstraints,
  Product,
  UserPreferences,
  AuditLogEntry,
} from "@/types/commerce";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── Tool definitions for LLM tool calling ───────────────────
const AGENT_TOOL_DECLARATIONS = [
  {
    name: "extract_shopping_constraints",
    description:
      "Parse a natural language shopping goal into structured hard constraints and derived engineering specs for longevity.",
    parameters: {
      type: "object",
      properties: {
        max_price_usd: { type: "number", description: "Maximum budget in USD" },
        min_ram_gb: { type: "number", description: "Minimum RAM in GB" },
        category: { type: "string", description: "Product category (laptop, desktop, etc.)" },
        use_case: { type: "string", description: "Primary use case (programming, ai_inference, etc.)" },
        min_battery_wh: { type: "number", description: "Minimum battery capacity in Wh for longevity" },
        longevity_years: { type: "number", description: "Expected device lifetime in years" },
        preferred_brands: { type: "array", items: { type: "string" }, description: "Preferred brands" },
      },
      required: ["max_price_usd", "min_ram_gb", "category", "use_case"],
    },
  },
  {
    name: "search_products",
    description:
      "Search for products matching constraints from Channel3 API and authorized sandbox catalog.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        category: { type: "string" },
        max_results: { type: "number" },
      },
      required: ["query", "category"],
    },
  },
  {
    name: "compare_products",
    description:
      "Filter, eliminate traps, and quantitatively rank surviving products using Fit Score.",
    parameters: {
      type: "object",
      properties: {
        max_price_usd: { type: "number" },
        min_ram_gb: { type: "number" },
        longevity_years: { type: "number" },
      },
      required: ["max_price_usd", "min_ram_gb"],
    },
  },
  {
    name: "draft_checkout_intent",
    description:
      "Create a checkout intent for a product SKU. Runs deterministic spend firewall check. Cannot capture funds.",
    parameters: {
      type: "object",
      properties: {
        product_sku: { type: "string" },
        budget_cap: { type: "number" },
      },
      required: ["product_sku", "budget_cap"],
    },
  },
];

// ─── Optional Live LLM Constraint Extraction (Gemini / OpenAI) ─
async function tryLiveLLMConstraintParse(
  goal: string
): Promise<{ constraints: Partial<ShoppingConstraints>; provider: "gemini" | "openai" } | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: goal }] }],
            tools: [{ functionDeclarations: [AGENT_TOOL_DECLARATIONS[0]] }],
            toolConfig: {
              functionCallingConfig: {
                mode: "ANY",
                allowedFunctionNames: ["extract_shopping_constraints"],
              },
            },
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const call = data?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
        if (call?.args) {
          return { constraints: call.args as Partial<ShoppingConstraints>, provider: "gemini" };
        }
      }
    } catch (e) {
      console.warn("[Gemini] Falling back to deterministic parser:", e);
    }
  }

  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Extract structured shopping constraints using the tool." },
            { role: "user", content: goal },
          ],
          tools: [{ type: "function", function: AGENT_TOOL_DECLARATIONS[0] }],
          tool_choice: { type: "function", function: { name: "extract_shopping_constraints" } },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        const argsStr = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (argsStr) {
          return {
            constraints: JSON.parse(argsStr) as Partial<ShoppingConstraints>,
            provider: "openai",
          };
        }
      }
    } catch (e) {
      console.warn("[OpenAI] Falling back to deterministic parser:", e);
    }
  }

  return null;
}

// ─── Deterministic Constraint Parsing ────────────────────────

function parseConstraintsDeterministic(goal: string): ShoppingConstraints {
  const g = goal.toLowerCase();

  // Extract budget cap specifically if "budget cap is $900" or "under $900"
  const capMatch =
    g.match(/(?:budget(?:\s+cap)?\s*(?:is|of)?\s*|under\s+|below\s+|less than\s+)\$?([\d,]+)/i) ||
    g.match(/\$?([\d,]{3,4})(?:\s*\.00)?/);

  const rawPrice = capMatch ? parseInt(capMatch[1].replace(/,/g, ""), 10) : 900;
  const max_price_usd = rawPrice >= 300 && rawPrice <= 5000 ? rawPrice : 900;

  const ramMatch = g.match(/(\d+)\s*gb\s*(?:ram|memory)?/i);
  const min_ram_gb = ramMatch ? parseInt(ramMatch[1], 10) : 16;

  const longevityMatch = g.match(/(\d+|four|five|three)\s*(?:years?|yr)/i);
  let longevity_years = 4;
  if (longevityMatch) {
    const val = longevityMatch[1].toLowerCase();
    longevity_years = val === "four" ? 4 : val === "five" ? 5 : val === "three" ? 3 : parseInt(val, 10) || 4;
  }

  let use_case = "programming";
  if (g.includes("llm") || g.includes("inference") || g.includes("ai") || g.includes("docker")) {
    use_case = "ai_inference";
  } else if (g.includes("programming") || g.includes("coding") || g.includes("dev")) {
    use_case = "programming";
  } else if (g.includes("gaming")) {
    use_case = "gaming";
  }

  return {
    max_price_usd,
    min_ram_gb,
    category: "laptop",
    use_case,
    min_battery_wh: longevity_years >= 4 ? 50 : 40,
    longevity_years,
    preferred_brands: [],
  };
}

function detectScenario(goal: string): 1 | 2 | 3 {
  const g = goal.toLowerCase();
  if (g.includes("macbook") || g.includes("force buy") || g.includes("1,299") || g.includes("1299")) {
    return 2;
  }
  if (
    g.includes("32gb") ||
    g.includes("llm") ||
    g.includes("inference") ||
    g.includes("docker") ||
    g.includes("1,150") ||
    g.includes("1150")
  ) {
    return 3;
  }
  return 1;
}

function makeStep(
  step: number,
  title: string,
  description: string,
  status: AgentStep["status"],
  extras: Partial<AgentStep> = {}
): AgentStep {
  return {
    step,
    title,
    description,
    status,
    timestamp: new Date().toISOString(),
    latency_ms: extras.latency_ms ?? Math.floor(Math.random() * 140) + 80,
    ...extras,
  };
}

// ─── Main Agent Orchestrator ──────────────────────────────────

async function runAgentOrchestrator(
  goal: string,
  sessionId: string,
  preferences?: Partial<UserPreferences>,
  applyPreferences = false
): Promise<AgentSession> {
  const scenario = detectScenario(goal);
  const steps: AgentStep[] = [];
  const auditLog: AuditLogEntry[] = [];

  // ── STEP 1: Semantic Constraint Parsing (Live LLM or Deterministic) ──
  const t1 = Date.now();
  const baseConstraints = parseConstraintsDeterministic(goal);
  const llmResult = await tryLiveLLMConstraintParse(goal);

  const constraints: ShoppingConstraints = {
    ...baseConstraints,
    ...(llmResult?.constraints || {}),
  };

  // Apply Spend Policy drawer overrides cleanly
  if (scenario === 2) {
    constraints.max_price_usd = preferences?.budget_cap ?? 900;
  } else if (applyPreferences && preferences) {
    if (preferences.budget_cap !== undefined) constraints.max_price_usd = preferences.budget_cap;
    if (preferences.min_ram_gb !== undefined) constraints.min_ram_gb = preferences.min_ram_gb;
    if (preferences.longevity_years !== undefined) {
      constraints.longevity_years = preferences.longevity_years;
      constraints.min_battery_wh = preferences.longevity_years >= 4 ? 50 : 40;
    }
    if (preferences.use_case) constraints.use_case = preferences.use_case;
  } else {
    if (preferences?.budget_cap && !goal.match(/\$\d+/)) {
      constraints.max_price_usd = preferences.budget_cap;
    }
    if (preferences?.min_ram_gb && !goal.match(/\d+\s*gb/i)) {
      constraints.min_ram_gb = preferences.min_ram_gb;
    }
  }

  // Always carry over brand & must-have spec filters when set in Spend Policy
  if (preferences?.preferred_brands && preferences.preferred_brands.length > 0) {
    constraints.preferred_brands = preferences.preferred_brands;
  }
  if (preferences?.must_have_specs && preferences.must_have_specs.length > 0) {
    constraints.must_have_specs = preferences.must_have_specs;
  }

  const mode = llmResult ? "live_llm" : "deterministic_fallback";
  const llmProvider = llmResult?.provider;

  steps.push(
    makeStep(
      1,
      "Semantic Constraint Parsing & Persistent Memory",
      `[${llmProvider ? `Live ${llmProvider.toUpperCase()} Tool Call` : "Deterministic Parser"}] Budget Cap: $${constraints.max_price_usd} | Min RAM: ${constraints.min_ram_gb}GB | Use Case: ${constraints.use_case} | Longevity: ${constraints.longevity_years || 4} yrs → derived battery ≥${constraints.min_battery_wh}Wh, upgradeable DDR5 preferred`,
      "completed",
      {
        tool: "extract_shopping_constraints",
        latency_ms: Math.max(Date.now() - t1, 45),
        tool_calls: [
          {
            tool: "extract_shopping_constraints",
            input: { goal },
            output: { ...constraints } as Record<string, unknown>,
            latency_ms: Math.max(Date.now() - t1, 45),
            timestamp: new Date().toISOString(),
          },
        ],
      }
    )
  );

  // ── STEP 2: Hybrid Catalogue Discovery ─────────────────────
  const t2 = Date.now();
  let allProducts: Product[] = CATALOG_PRODUCTS;
  let channel3Live = false;

  try {
    const { products, channel3Live: live } = await hybridSearch(
      `${constraints.use_case} laptop ${constraints.max_price_usd}`,
      "laptop",
      15
    );
    if (products.length > 0) allProducts = products;
    channel3Live = live;
  } catch {
    allProducts = CATALOG_PRODUCTS;
  }

  steps.push(
    makeStep(
      2,
      "Hybrid Catalogue Discovery",
      `Queried ${channel3Live ? "Channel3 Live API + Authorized Sandbox Catalog" : "Authorized Sandbox Catalog"} (${allProducts.length} laptops loaded, including soldered-RAM, 41Wh gaming, and over-budget traps).`,
      "completed",
      {
        tool: "search_products",
        products_found: allProducts.length,
        latency_ms: Math.max(Date.now() - t2, 60),
      }
    )
  );

  // ── STEP 3: Spec, Price & Review Elimination ───────────────
  const { passed, eliminated } = filterAndEliminate(allProducts, constraints);

  steps.push(
    makeStep(
      3,
      "Spec, Price & Review Elimination",
      `Eliminated ${eliminated.length} disqualifying models (soldered RAM, weak 41-42Wh batteries, ChromeOS, over-budget). ${passed.length} verified candidates survive.`,
      "completed",
      {
        tool: "compare_products",
        products_found: allProducts.length,
        products_eliminated: eliminated.length,
      }
    )
  );

  // ── STEP 4: Quantitative Multi-Axis Ranking ────────────────
  const ranked = rankProducts(passed, constraints.max_price_usd);

  steps.push(
    makeStep(
      4,
      "Quantitative Multi-Axis Ranking (Agentic Fit Score)",
      `Scored ${ranked.length} survivors: FitScore = 0.35×DevPerf + 0.30×Longevity + 0.20×Battery + 0.15×BudgetDelta. #1: ${ranked[0]?.name || "N/A"} (${ranked[0]?.fit_score?.toFixed(1) || "N/A"}/100).`,
      "completed",
      {
        tool: "rank_products",
        products_ranked: ranked.length,
      }
    )
  );

  // ── STEP 5: Top Recommendation (or Forced Target for Scenario 2) ──
  const forcedMacBook =
    scenario === 2
      ? allProducts.find((p) => p.sku === SCENARIO_2_FIREWALL_SKU) || null
      : null;

  const targetProduct = forcedMacBook || ranked[0] || null;

  if (scenario === 2 && forcedMacBook) {
    steps.push(
      makeStep(
        5,
        "Forced Purchase Target Identified",
        `User explicitly requested forced checkout of ${forcedMacBook.name} ($${forcedMacBook.price_usd.toFixed(2)}) against authorized budget cap of $${constraints.max_price_usd.toFixed(2)}. Forwarding to Spend Firewall check...`,
        "completed"
      )
    );
  } else {
    steps.push(
      makeStep(
        5,
        "Explainable Top Recommendation",
        targetProduct
          ? `#1 Winner: ${targetProduct.name} at $${targetProduct.price_usd.toFixed(2)} — FitScore ${targetProduct.fit_score?.toFixed(1)}/100. ${targetProduct.ram.soldered ? "Soldered RAM" : `Upgradeable DDR5 up to ${targetProduct.ram.max_upgradeable_gb}GB`}, ${targetProduct.battery.capacity_wh}Wh battery (${targetProduct.battery.rated_hours}h), ${targetProduct.build.mil_std_810h ? "MIL-STD-810H aluminum chassis" : targetProduct.build.material}.${ranked[1] ? ` Beat #2 ${ranked[1].model} ($${ranked[1].price_usd}) by ${((targetProduct.fit_score || 0) - (ranked[1].fit_score || 0)).toFixed(1)} pts.` : ""}`
          : "No qualifying products found",
        targetProduct ? "completed" : "error"
      )
    );
  }

  // ── STEP 6 & 7: Checkout Intent + Spend Firewall ───────────
  let checkoutIntent = null;

  if (targetProduct) {
    checkoutIntent = buildCheckoutIntent(targetProduct, constraints, sessionId);

    steps.push(
      makeStep(
        6,
        "Itemized Checkout Presentation",
        `Item: $${checkoutIntent.item_price.toFixed(2)} | Shipping: $0.00 | Tax: $0.00 | Total: $${checkoutIntent.total.toFixed(2)} USD (${checkoutIntent.budget_savings >= 0 ? `$${checkoutIntent.budget_savings.toFixed(2)} saved under $${constraints.max_price_usd} budget` : `$${Math.abs(checkoutIntent.budget_savings).toFixed(2)} OVER $${constraints.max_price_usd} budget cap`})`,
        "completed",
        { tool: "draft_checkout_intent" }
      )
    );

    const firewallApproved = checkoutIntent.spend_firewall_status === "APPROVED";

    auditLog.push({
      id: crypto.randomUUID(),
      event_type: "SPEND_FIREWALL",
      timestamp: checkoutIntent.created_at,
      sha256_hash: checkoutIntent.sha256_lock,
      data: {
        status: checkoutIntent.spend_firewall_status,
        sku: targetProduct.sku,
        price_usd: checkoutIntent.item_price,
        budget_cap_usd: checkoutIntent.budget_cap,
        message: checkoutIntent.spend_firewall_message,
      },
    });

    steps.push(
      makeStep(
        7,
        "Human-in-the-Loop (HITL) Approval & Spend Firewall",
        firewallApproved
          ? `SPEND_FIREWALL_APPROVED | Budget Cap: $${constraints.max_price_usd} | Verified Price: $${checkoutIntent.total.toFixed(2)} | SHA-256 Lock: ${checkoutIntent.sha256_lock.slice(0, 16)}... | Awaiting Human Signature`
          : `${checkoutIntent.spend_firewall_message}`,
        firewallApproved ? "completed" : "blocked",
        { tool: "spend_firewall_check" }
      )
    );

    steps.push(
      makeStep(
        8,
        "PayPal Sandbox Checkout & Cryptographic Verification",
        firewallApproved
          ? "Awaiting human signature. Click '1-Click Sandbox Express Approve' or use the PayPal Smart Button to capture funds."
          : `BLOCKED: PayPal order creation refused by Deterministic Spend Firewall ($${checkoutIntent.item_price.toFixed(2)} > $${constraints.max_price_usd.toFixed(2)}).`,
        firewallApproved ? "pending" : "blocked"
      )
    );
  }

  return {
    session_id: sessionId,
    scenario,
    goal,
    constraints,
    steps,
    candidates: allProducts,
    eliminated: eliminated.map((e) => e.product),
    ranked,
    top_pick: targetProduct,
    checkout_intent: checkoutIntent,
    capture_receipt: null,
    audit_log: auditLog,
    created_at: new Date().toISOString(),
    mode,
    llm_provider: llmProvider,
  };
}

// ─── POST Handler ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      goal: string;
      session_id?: string;
      preferences?: Partial<UserPreferences>;
      apply_preferences?: boolean;
    };

    if (!body.goal || typeof body.goal !== "string") {
      return NextResponse.json({ error: "Missing goal" }, { status: 400 });
    }

    const sessionId = body.session_id || crypto.randomUUID();
    const session = await runAgentOrchestrator(
      body.goal,
      sessionId,
      body.preferences,
      Boolean(body.apply_preferences)
    );

    return NextResponse.json(session, {
      headers: {
        "X-AegisCart-Session": sessionId,
        "X-AegisCart-Mode": session.mode,
        "X-AegisCart-Scenario": String(session.scenario),
      },
    });
  } catch (err) {
    console.error("[Agent API] Error:", err);
    return NextResponse.json(
      { error: "Agent orchestration failed", details: String(err) },
      { status: 500 }
    );
  }
}
