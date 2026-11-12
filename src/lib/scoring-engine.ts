// ============================================================
// AegisCart AI — Deterministic Scoring Engine
// Fit Score formula, constraint filter, spend firewall,
// SHA-256 hash lock. 100% GPU-offloadable via WebGL in browser.
// ============================================================

import crypto from "crypto";
import type {
  Product,
  ShoppingConstraints,
  SpendFirewallResult,
  CheckoutIntent,
} from "@/types/commerce";

// ─── Fit Score Weights ───────────────────────────────────────
const WEIGHT_DEV_PERF = 0.35;
const WEIGHT_LONGEVITY = 0.30;
const WEIGHT_BATTERY = 0.20;
const WEIGHT_PRICE_DELTA = 0.15;

// ─── Scoring helpers ─────────────────────────────────────────

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/** Dev Performance Score (0–100) based on CPU benchmark + RAM */
function calcDevPerformanceScore(product: Product): number {
  const benchMax = 32000; // Ryzen 9 7945HX reference
  const cpuScore = clamp((product.cpu.benchmark_score / benchMax) * 100);

  // RAM bonus: 16GB=base, 32GB=+10, 64GB+=+15, penalize <16GB
  const ramScore = (() => {
    if (product.ram.size_gb >= 32) return 100;
    if (product.ram.size_gb >= 16) return 85;
    if (product.ram.size_gb >= 8) return 50;
    return 20;
  })();

  // Storage speed bonus
  const storageScore = clamp((product.storage.read_mbps / 7400) * 100);

  return clamp(cpuScore * 0.6 + ramScore * 0.3 + storageScore * 0.1);
}

/** 4-Year Longevity Score (0–100) */
function calcLongevityScore(product: Product): number {
  let score = 25; // baseline so high-longevity specs differentiate without saturating at 100

  // Upgradeable RAM is critical for longevity
  if (!product.ram.soldered) score += 20;
  else score -= 20;

  // RAM type modernity
  if (product.ram.type === "DDR5" || product.ram.type === "LPDDR5X") score += 10;
  else if (product.ram.type === "LPDDR5") score += 8;
  else if (product.ram.type === "DDR4") score += 2;

  // CPU architecture generation (Zen 4 / Meteor Lake = most future-proof)
  const arch = product.cpu.architecture.toLowerCase();
  if (arch.includes("zen 4") || arch.includes("meteor lake") || arch.includes("m3")) score += 15;
  else if (arch.includes("zen 3+") || arch.includes("raptor lake")) score += 11;
  else if (arch.includes("zen 3")) score += 8;
  else if (arch.includes("zen 2") || arch.includes("alder lake")) score += 3;

  // Build quality (MIL-STD)
  if (product.build.mil_std_810h) score += 14;
  if (product.build.material === "Aluminum" || product.build.material === "Magnesium Alloy") score += 5;

  // Warranty
  if (product.warranty_years >= 3) score += 12;
  else if (product.warranty_years >= 2) score += 5;

  // Repairability (Framework = maximum)
  if (product.brand === "Framework") score += 6;

  // CPU fabrication node (smaller = more efficient, longer relevance)
  if (product.cpu.node_nm <= 4) score += 8;
  else if (product.cpu.node_nm <= 7) score += 4;

  return clamp(score);
}

/** Battery Endurance Score (0–100) */
function calcBatteryEnduranceScore(product: Product): number {
  const whMax = 100; // reference: highest in catalog
  const whScore = clamp((product.battery.capacity_wh / whMax) * 80);
  const hoursScore = clamp((product.battery.rated_hours / 20) * 20);
  const fastChargeBonus = product.battery.fast_charge ? 5 : 0;
  return clamp(whScore + hoursScore + fastChargeBonus);
}

/** Price Delta Score (0–100): rewards staying under budget */
function calcPriceDeltaScore(product: Product, budgetCap: number): number {
  const delta = budgetCap - product.price_usd;
  if (delta < 0) return 0; // over budget
  return clamp((delta / budgetCap) * 100);
}

// ─── Main Scoring Function ───────────────────────────────────

export function scoreProduct(product: Product, budget: number): Product {
  const devPerf = calcDevPerformanceScore(product);
  const longevity = calcLongevityScore(product);
  const battery = calcBatteryEnduranceScore(product);
  const priceDelta = calcPriceDeltaScore(product, budget);

  const fitScore =
    WEIGHT_DEV_PERF * devPerf +
    WEIGHT_LONGEVITY * longevity +
    WEIGHT_BATTERY * battery +
    WEIGHT_PRICE_DELTA * priceDelta;

  return {
    ...product,
    fit_score: Math.round(fitScore * 10) / 10,
    dev_performance_score: Math.round(devPerf),
    longevity_score: Math.round(longevity),
    battery_endurance_score: Math.round(battery),
    price_delta_score: Math.round(priceDelta),
  };
}

// ─── Constraint Filter + Elimination Engine ──────────────────

export interface EliminationLog {
  product: Product;
  reason: string;
  rule: string;
}

export interface FilterResult {
  passed: Product[];
  eliminated: EliminationLog[];
}

export function filterAndEliminate(
  products: Product[],
  constraints: ShoppingConstraints
): FilterResult {
  const passed: Product[] = [];
  const eliminated: EliminationLog[] = [];

  for (const product of products) {
    const reasons: string[] = [];

    // ── Hard Constraints ──────────────────────────────────────

    // 1. Price cap
    if (product.price_usd > constraints.max_price_usd) {
      reasons.push(
        `Price $${product.price_usd.toFixed(2)} exceeds budget cap of $${constraints.max_price_usd.toFixed(2)}`
      );
    }

    // 2. Minimum RAM
    if (product.ram.size_gb < constraints.min_ram_gb) {
      reasons.push(
        `RAM ${product.ram.size_gb}GB < required ${constraints.min_ram_gb}GB minimum`
      );
    }

    // 3. Category
    if (
      constraints.category &&
      !product.category.toLowerCase().includes(constraints.category.toLowerCase())
    ) {
      reasons.push(`Category "${product.category}" does not match "${constraints.category}"`);
    }

    // ── Derived Longevity Rules (4-year programming durability) ──

    // 4. Battery floor: 55Wh for longevity
    if (
      constraints.min_battery_wh !== undefined &&
      product.battery.capacity_wh < constraints.min_battery_wh
    ) {
      reasons.push(
        `Battery ${product.battery.capacity_wh}Wh < ${constraints.min_battery_wh}Wh minimum for 4-year endurance`
      );
    }

    // 5. Soldered RAM is a longevity trap (auto-derived for 4-year use case)
    if (
      constraints.longevity_years &&
      constraints.longevity_years >= 4 &&
      product.ram.soldered &&
      product.ram.size_gb < 16
    ) {
      reasons.push(
        `Soldered ${product.ram.size_gb}GB RAM cannot be upgraded — fails 4-year longevity requirement`
      );
    }

    // 6. OS mismatch for use_case = programming (ChromeOS cannot run Docker)
    if (
      constraints.use_case === "programming" &&
      product.os.toLowerCase().includes("chromeos")
    ) {
      reasons.push(
        `ChromeOS cannot run Docker/native dev tools — eliminated for programming use case`
      );
    }

    // 7. CPU too weak for 4+ year programming (benchmark < 7000 = i3/Pentium tier)
    if (
      constraints.longevity_years &&
      constraints.longevity_years >= 4 &&
      product.cpu.benchmark_score < 7000
    ) {
      reasons.push(
        `CPU benchmark ${product.cpu.benchmark_score} (Cinebench R23 Multi) is too weak for 4-year programming workloads (minimum: 7,000)`
      );
    }

    // 8. Preferred Brands filter (when user explicitly restricts brands)
    if (
      constraints.preferred_brands &&
      constraints.preferred_brands.length > 0 &&
      !constraints.preferred_brands.some(
        (b) => b.toLowerCase() === product.brand.toLowerCase()
      )
    ) {
      reasons.push(
        `Brand "${product.brand}" is not in selected manufacturers (${constraints.preferred_brands.join(", ")})`
      );
    }

    // 9. Must-have specs filter from Spend Policy drawer
    if (constraints.must_have_specs && constraints.must_have_specs.length > 0) {
      for (const spec of constraints.must_have_specs) {
        if (spec === "Upgradeable RAM" && product.ram.soldered) {
          reasons.push(`Soldered RAM fails required "Upgradeable RAM" policy`);
        } else if (spec === "MIL-STD-810H" && !product.build.mil_std_810h) {
          reasons.push(`Lacks MIL-STD-810H durability certification`);
        } else if (spec === "DDR5 RAM" && product.ram.type !== "DDR5" && product.ram.type !== "LPDDR5X") {
          reasons.push(`Memory type ${product.ram.type} does not meet DDR5 requirement`);
        } else if (spec === "NVMe Gen4 SSD" && !product.storage.type.includes("Gen4")) {
          reasons.push(`Storage ${product.storage.type} is slower than required NVMe Gen4 SSD`);
        } else if (
          spec === "Thunderbolt 4" &&
          !product.build.ports.some((pt) => pt.toLowerCase().includes("thunderbolt") || pt.toLowerCase().includes("tbt4"))
        ) {
          reasons.push(`Missing Thunderbolt 4 port`);
        } else if (spec === "Fast Charging" && !product.battery.fast_charge) {
          reasons.push(`Lacks fast charging support`);
        } else if (
          spec === "Linux Compatible" &&
          product.os.toLowerCase().includes("chromeos")
        ) {
          reasons.push(`ChromeOS does not meet Linux compatibility requirement`);
        }
      }
    }

    if (reasons.length > 0) {
      eliminated.push({
        product: { ...product, eliminated: true, elimination_reason: reasons[0] },
        reason: reasons.join("; "),
        rule: reasons[0],
      });
    } else {
      passed.push({ ...product, eliminated: false });
    }
  }

  return { passed, eliminated };
}

// ─── Rank Survivors ───────────────────────────────────────────

export function rankProducts(
  products: Product[],
  budget: number
): Product[] {
  return products
    .map((p) => scoreProduct(p, budget))
    .sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0))
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

// ─── SHA-256 Cart Integrity Hash ─────────────────────────────

export function computeCartHash(
  sku: string,
  price: number,
  currency: string,
  budgetCap: number
): string {
  const payload = `${sku}:${price.toFixed(2)}:${currency}:${budgetCap.toFixed(2)}`;
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

export function computeHmacHash(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

// ─── Idempotency Key Generator ────────────────────────────────

export function generateIdempotencyKey(
  sku: string,
  sessionId: string
): string {
  const timestamp = Date.now().toString(36);
  return `aegis-${sessionId.slice(0, 8)}-${sku.slice(0, 10)}-${timestamp}`.toUpperCase();
}

// ─── Deterministic Spend Firewall ────────────────────────────

export function runSpendFirewall(
  product: Product,
  budgetCap: number,
  sessionId: string
): SpendFirewallResult {
  const price = product.price_usd;
  const sha256Lock = computeCartHash(product.sku, price, "USD", budgetCap);
  const idempotencyKey = generateIdempotencyKey(product.sku, sessionId);
  const timestamp = new Date().toISOString();

  if (price > budgetCap) {
    return {
      approved: false,
      price,
      budget_cap: budgetCap,
      overage: price - budgetCap,
      sha256_lock: sha256Lock,
      idempotency_key: idempotencyKey,
      timestamp,
      error_code: "SPEND_FIREWALL_BLOCKED",
      message: `SPEND_FIREWALL_BLOCKED: $${price.toFixed(2)} exceeds authorized budget cap of $${budgetCap.toFixed(2)}. Overage: $${(price - budgetCap).toFixed(2)}. PayPal order creation refused.`,
    };
  }

  return {
    approved: true,
    price,
    budget_cap: budgetCap,
    sha256_lock: sha256Lock,
    idempotency_key: idempotencyKey,
    timestamp,
    message: `SPEND_FIREWALL_APPROVED: $${price.toFixed(2)} is within authorized budget cap of $${budgetCap.toFixed(2)}. Savings: $${(budgetCap - price).toFixed(2)}.`,
  };
}

// ─── Build CheckoutIntent ─────────────────────────────────────

export function buildCheckoutIntent(
  product: Product,
  constraints: ShoppingConstraints,
  sessionId: string
): CheckoutIntent {
  const firewall = runSpendFirewall(product, constraints.max_price_usd, sessionId);

  return {
    product,
    item_price: product.price_usd,
    shipping: 0,
    tax: 0,
    total: product.price_usd,
    currency: "USD",
    budget_cap: constraints.max_price_usd,
    budget_savings: constraints.max_price_usd - product.price_usd,
    idempotency_key: firewall.idempotency_key,
    sha256_lock: firewall.sha256_lock,
    spend_firewall_status: firewall.approved ? "APPROVED" : "BLOCKED",
    spend_firewall_message: firewall.message,
    merchant_name: "AegisCart Authorized Sandbox Store",
    created_at: firewall.timestamp,
  };
}

// ─── GPU-accelerated scoring hint (browser-side) ─────────────
// In browser, the scoring math above is designed to be offloaded
// to WebGL shaders via gpu.js or @tensorflow/tfjs-backend-webgl.
// The pure-math functions above (no I/O) are ideal for GPU compute.
// See: src/lib/gpu-scoring-hint.ts for the browser WebGL bridge.
export const GPU_SCORING_HINT = {
  recommended_backend: "webgl",
  parallelizable: true,
  note: "scoreProduct() and calcDevPerformanceScore() are pure math — GPU-offloadable via WebGL",
};

