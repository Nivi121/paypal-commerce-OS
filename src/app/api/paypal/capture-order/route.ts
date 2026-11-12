// ============================================================
// AegisCart AI — PayPal Capture Order API Route
// POST /api/paypal/capture-order
// SHA-256 hash verification + PayPal Orders v2 capture
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { capturePayPalOrder } from "@/lib/paypal-server";
import { computeCartHash } from "@/lib/scoring-engine";
import type { CheckoutIntent, Product } from "@/types/commerce";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as {
      order_id: string;
      product: Product;
      budget_cap: number;
      session_id: string;
      sha256_lock: string;
      idempotency_key: string;
      currency?: string;
    };

    const {
      order_id,
      product,
      budget_cap,
      session_id,
      sha256_lock,
      idempotency_key,
    } = body;

    if (!order_id || !product || !budget_cap || !session_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const currency = (body.currency || "USD") as "USD";

    // ── 1. Re-verify SHA-256 Cart Integrity Hash ─────────────────
    const expectedHash = computeCartHash(product.sku, product.price_usd, currency, budget_cap);
    const hashMatch = sha256_lock === expectedHash;

    if (!hashMatch) {
      return NextResponse.json(
        {
          error: "CART_INTEGRITY_VIOLATION",
          message: "SHA-256 cart hash mismatch — potential tamper detected. Order capture refused.",
          expected_hash: expectedHash,
          received_hash: sha256_lock,
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // ── 2. Build intent for capture ─────────────────────────────
    const intent: CheckoutIntent = {
      product,
      item_price: product.price_usd,
      shipping: 0,
      tax: 0,
      total: product.price_usd,
      currency,
      budget_cap,
      budget_savings: budget_cap - product.price_usd,
      idempotency_key,
      sha256_lock,
      spend_firewall_status: "APPROVED",
      merchant_name: "AegisCart Authorized Sandbox Store",
      created_at: new Date().toISOString(),
    };

    // ── 3. Capture the PayPal order ──────────────────────────────
    const capture = await capturePayPalOrder(order_id, intent);

    // ── 4. Verify completion ─────────────────────────────────────
    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: "CAPTURE_NOT_COMPLETED",
          message: `PayPal capture returned status: ${capture.status}`,
          capture,
        },
        { status: 402 }
      );
    }

    // Verify captured amount matches expected
    const capturedAmount = parseFloat(capture.amount);
    const expectedAmount = product.price_usd;
    const amountVerified = Math.abs(capturedAmount - expectedAmount) < 0.01;

    return NextResponse.json(
      {
        success: true,
        verified: true,
        order_id: capture.order_id,
        capture_id: capture.capture_id,
        status: capture.status,
        amount: capture.amount,
        currency: capture.currency,
        amount_verified: amountVerified,
        sha256_verified: capture.sha256_verified,
        payer_email: capture.payer_email,
        payer_name: capture.payer_name,
        merchant_name: capture.merchant_name,
        idempotency_key: capture.idempotency_key,
        sha256_lock: capture.sha256_lock,
        timestamp: capture.timestamp,
        simulation_mode: capture.simulation_mode,
        audit_summary: {
          product_name: product.name,
          product_sku: product.sku,
          session_id,
          sha256_hash: sha256_lock,
          hash_verified: true,
          amount_verified: amountVerified,
          budget_cap,
          savings: budget_cap - product.price_usd,
        },
        raw_capture: capture.raw_capture,
      },
      {
        headers: {
          "X-AegisCart-Capture": capture.capture_id,
          "X-AegisCart-SHA256-Verified": String(capture.sha256_verified),
          "X-AegisCart-Amount-Verified": String(amountVerified),
        },
      }
    );
  } catch (err) {
    console.error("[capture-order] Error:", err);
    return NextResponse.json(
      { error: "Failed to capture PayPal order", details: String(err) },
      { status: 500 }
    );
  }
}

