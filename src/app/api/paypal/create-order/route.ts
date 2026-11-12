// ============================================================
// AegisCart AI — PayPal Create Order API Route
// POST /api/paypal/create-order
// Deterministic Spend Firewall + PayPal Orders v2
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runSpendFirewall, generateIdempotencyKey, computeCartHash } from "@/lib/scoring-engine";
import { createPayPalOrder } from "@/lib/paypal-server";
import type { CheckoutIntent, Product } from "@/types/commerce";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as {
      product: Product;
      budget_cap: number;
      session_id: string;
      currency?: string;
    };

    if (!body.product || !body.budget_cap || !body.session_id) {
      return NextResponse.json(
        { error: "Missing required fields: product, budget_cap, session_id" },
        { status: 400 }
      );
    }

    const { product, budget_cap, session_id } = body;
    const currency = (body.currency || "USD") as "USD";

    // ── 1. DETERMINISTIC SPEND FIREWALL ─────────────────────────
    const firewall = runSpendFirewall(product, budget_cap, session_id);

    if (!firewall.approved) {
      // Hard block — do NOT create a PayPal order
      return NextResponse.json(
        {
          blocked: true,
          error_code: firewall.error_code,
          message: firewall.message,
          price: firewall.price,
          budget_cap: firewall.budget_cap,
          overage: firewall.overage,
          sha256_lock: firewall.sha256_lock,
          idempotency_key: firewall.idempotency_key,
          timestamp: firewall.timestamp,
        },
        { status: 403 }
      );
    }

    // ── 2. Build Checkout Intent ─────────────────────────────────
    const idempotencyKey = generateIdempotencyKey(product.sku, session_id);
    const sha256Lock = computeCartHash(product.sku, product.price_usd, currency, budget_cap);

    const intent: CheckoutIntent = {
      product,
      item_price: product.price_usd,
      shipping: 0,
      tax: 0,
      total: product.price_usd,
      currency,
      budget_cap,
      budget_savings: budget_cap - product.price_usd,
      idempotency_key: idempotencyKey,
      sha256_lock: sha256Lock,
      spend_firewall_status: "APPROVED",
      spend_firewall_message: firewall.message,
      merchant_name: "AegisCart Authorized Sandbox Store",
      created_at: new Date().toISOString(),
    };

    // ── 3. Create PayPal Order (live or simulated) ───────────────
    const order = await createPayPalOrder(intent);

    return NextResponse.json(
      {
        order_id: order.id,
        status: order.status,
        links: order.links,
        idempotency_key: order.idempotency_key,
        sha256_lock: order.sha256_lock,
        spend_firewall: {
          status: "APPROVED",
          message: firewall.message,
          price: firewall.price,
          budget_cap: firewall.budget_cap,
          savings: budget_cap - product.price_usd,
        },
        simulation_mode: order.id.startsWith("AEGIS-SIM-"),
        created_at: order.create_time || new Date().toISOString(),
      },
      {
        headers: {
          "X-AegisCart-Firewall": "APPROVED",
          "X-AegisCart-SHA256": sha256Lock,
          "X-Idempotency-Key": idempotencyKey,
        },
      }
    );
  } catch (err) {
    console.error("[create-order] Error:", err);
    return NextResponse.json(
      { error: "Failed to create PayPal order", details: String(err) },
      { status: 500 }
    );
  }
}

