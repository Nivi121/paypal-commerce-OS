"use client";

import { useState, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  CreditCard,
  Wallet,
  ArrowLeft,
} from "lucide-react";
import type {
  Product,
  CheckoutIntent,
  PayPalCaptureResponse,
} from "@/types/commerce";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import ProductVisual from "@/components/ProductVisual";

interface CheckoutApprovalCardProps {
  intent: CheckoutIntent | null;
  product: Product | null;
  sessionId: string;
  onCapture: (receipt: PayPalCaptureResponse) => void;
  onFirewallBlock: (message: string) => void;
  onBackToProducts?: () => void;
}

type PaymentMethod = "express" | "paypal_wallet" | "card";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="p-1 rounded hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
      title="Copy"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-700" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export default function CheckoutApprovalCard({
  intent,
  product,
  sessionId,
  onCapture,
  onFirewallBlock,
  onBackToProducts,
}: CheckoutApprovalCardProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("express");
  const [checkoutState, setCheckoutState] = useState<
    "idle" | "creating" | "approving" | "capturing" | "complete" | "error" | "blocked"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "sb";

  const createOrder = useCallback(async () => {
    if (!product || !intent) return "";
    setCheckoutState("creating");
    setErrorMsg("");

    try {
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          budget_cap: intent.budget_cap,
          session_id: sessionId,
          currency: "USD",
        }),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (res.status === 403 && data.blocked) {
        setCheckoutState("blocked");
        onFirewallBlock(data.message as string);
        return "";
      }

      if (!res.ok) throw new Error(String(data.error || "Order creation failed"));

      const oid = data.order_id as string;
      setCheckoutState("approving");
      return oid;
    } catch (err) {
      setCheckoutState("error");
      setErrorMsg(String(err));
      return "";
    }
  }, [product, intent, sessionId, onFirewallBlock]);

  const captureOrder = useCallback(
    async (oid: string) => {
      if (!product || !intent) return;
      setCheckoutState("capturing");

      try {
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: oid,
            product,
            budget_cap: intent.budget_cap,
            session_id: sessionId,
            sha256_lock: intent.sha256_lock,
            idempotency_key: intent.idempotency_key,
            currency: "USD",
          }),
        });

        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) throw new Error(String(data.error || "Capture failed"));

        setCheckoutState("complete");
        onCapture(data as unknown as PayPalCaptureResponse);
      } catch (err) {
        setCheckoutState("error");
        setErrorMsg(String(err));
      }
    },
    [product, intent, sessionId, onCapture]
  );

  const handleExpressApprove = useCallback(async () => {
    const oid = await createOrder();
    if (oid) await captureOrder(oid);
  }, [createOrder, captureOrder]);

  if (!intent || !product) {
    return (
      <div className="glass-neo-card p-8 text-center space-y-2">
        <Lock className="w-6 h-6 text-zinc-400 mx-auto" />
        <p className="text-base font-medium text-zinc-700">No product selected</p>
        <p className="text-sm text-zinc-500">
          Select a product first to initialize PayPal checkout.
        </p>
      </div>
    );
  }

  const isBlocked = intent.spend_firewall_status === "BLOCKED";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Order Summary & Policy Verification */}
      <div className="lg:col-span-5 space-y-4">
        <div className="glass-neo-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900">Order Summary</h3>
            {isBlocked ? (
              <span className="tag-danger">Policy Blocked</span>
            ) : (
              <span className="tag-success">Policy Approved</span>
            )}
          </div>

          <div className="neo-tile p-4 rounded-xl flex items-center gap-4">
            <ProductVisual product={product} size="sm" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-sm font-semibold text-zinc-900 leading-snug">
                {product.name}
              </div>
              <div className="text-xs text-zinc-600">
                {product.cpu.model} · {product.ram.size_gb}GB {product.ram.type}
              </div>
              <div className="text-[11px] font-mono text-zinc-400">
                SKU: {product.sku}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600">Subtotal</span>
              <span className="text-zinc-900 font-medium tabular-nums">
                ${intent.item_price.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Shipping ({intent.merchant_name})</span>
              <span className="text-zinc-900">$0.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Estimated Tax</span>
              <span className="text-zinc-900">$0.00</span>
            </div>
            <div className="border-t border-zinc-200/80 pt-3 flex justify-between items-baseline">
              <span className="font-semibold text-zinc-900">Total Due</span>
              <span className="text-2xl font-bold text-zinc-900 tabular-nums">
                ${intent.total.toFixed(2)} USD
              </span>
            </div>
          </div>

          {/* Cryptographic Integrity Metadata */}
          <div className="neo-inset p-3.5 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-500">Budget Cap</span>
              <span className="font-mono font-semibold text-zinc-800 tabular-nums">
                ${intent.budget_cap.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-500">SHA-256 Lock</span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-mono text-zinc-800 truncate">
                  {intent.sha256_lock.slice(0, 16)}...
                </span>
                <CopyButton text={intent.sha256_lock} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-500">PayPal-Request-Id</span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-mono text-zinc-800 truncate">
                  {intent.idempotency_key.slice(0, 16)}...
                </span>
                <CopyButton text={intent.idempotency_key} />
              </div>
            </div>
          </div>

          {onBackToProducts && (
            <button
              type="button"
              onClick={onBackToProducts}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change selected product</span>
            </button>
          )}
        </div>
      </div>

      {/* Right Column: Payment Method & PayPal Gateway */}
      <div className="lg:col-span-7">
        <div
          className={`glass-neo-card p-6 sm:p-7 space-y-5 ${
            isBlocked ? "border-red-300/80" : ""
          }`}
        >
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">
              {isBlocked ? "Checkout Blocked by Spend Policy" : "Select Payment Method"}
            </h3>
            <p className="text-sm text-zinc-500 mt-0.5">
              {isBlocked
                ? "The deterministic Spend Firewall refused to initialize a PayPal order."
                : "Authorize funds safely through PayPal Orders v2."}
            </p>
          </div>

          {isBlocked ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50/90 border border-red-200 space-y-2">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-red-900">
                      SPEND_FIREWALL_BLOCKED
                    </div>
                    <p className="text-xs font-mono text-red-800 leading-relaxed">
                      {intent.spend_firewall_message}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="neo-inset p-4 rounded-xl">
                  <div className="text-xs text-zinc-500">Requested Total</div>
                  <div className="text-xl font-bold text-red-700 tabular-nums mt-1">
                    ${intent.item_price.toFixed(2)}
                  </div>
                </div>
                <div className="neo-inset p-4 rounded-xl">
                  <div className="text-xs text-zinc-500">Authorized Cap</div>
                  <div className="text-xl font-bold text-zinc-900 tabular-nums mt-1">
                    ${intent.budget_cap.toFixed(2)}
                  </div>
                </div>
              </div>

              {onBackToProducts && (
                <button
                  type="button"
                  onClick={onBackToProducts}
                  className="btn-primary w-full py-3.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Select a Within-Budget Laptop</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                <span className="text-sm text-emerald-900">
                  Spend Firewall passed: <strong>${intent.total.toFixed(2)}</strong> is{" "}
                  <strong>${intent.budget_savings.toFixed(2)}</strong> under your{" "}
                  <strong>${intent.budget_cap.toFixed(2)}</strong> cap.
                </span>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("express")}
                  className={`w-full flex items-start gap-3.5 p-4 rounded-xl text-left transition-all cursor-pointer ${
                    paymentMethod === "express" ? "neo-inset border-zinc-400" : "neo-tile"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                      paymentMethod === "express"
                        ? "border-zinc-900"
                        : "border-zinc-400"
                    }`}
                  >
                    {paymentMethod === "express" && (
                      <div className="w-2 h-2 rounded-full bg-zinc-900" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-zinc-900">
                      Express Sandbox Checkout (Instant API Capture)
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                      Executes PayPal order creation and SHA-256 capture verification in one step.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("paypal_wallet")}
                  className={`w-full flex items-start gap-3.5 p-4 rounded-xl text-left transition-all cursor-pointer ${
                    paymentMethod === "paypal_wallet" ? "neo-inset border-zinc-400" : "neo-tile"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                      paymentMethod === "paypal_wallet"
                        ? "border-zinc-900"
                        : "border-zinc-400"
                    }`}
                  >
                    {paymentMethod === "paypal_wallet" && (
                      <div className="w-2 h-2 rounded-full bg-zinc-900" />
                    )}
                  </div>
                  <Wallet className="w-4 h-4 text-zinc-700 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-zinc-900">
                      PayPal Sandbox Wallet
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5">
                      Authenticate using a PayPal Sandbox buyer account popup.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`w-full flex items-start gap-3.5 p-4 rounded-xl text-left transition-all cursor-pointer ${
                    paymentMethod === "card" ? "neo-inset border-zinc-400" : "neo-tile"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                      paymentMethod === "card"
                        ? "border-zinc-900"
                        : "border-zinc-400"
                    }`}
                  >
                    {paymentMethod === "card" && (
                      <div className="w-2 h-2 rounded-full bg-zinc-900" />
                    )}
                  </div>
                  <CreditCard className="w-4 h-4 text-zinc-700 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-zinc-900">
                      Debit or Credit Card (via PayPal Gateway)
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5">
                      Standard card form hosted by PayPal Smart Payment Buttons.
                    </div>
                  </div>
                </button>
              </div>

              {/* Gateway Execution Area */}
              {checkoutState !== "complete" && (
                <div className="pt-3 border-t border-zinc-200/70">
                  {paymentMethod === "express" ? (
                    <button
                      type="button"
                      onClick={handleExpressApprove}
                      disabled={["creating", "approving", "capturing"].includes(
                        checkoutState
                      )}
                      className="btn-primary w-full py-3.5 text-sm"
                    >
                      {["creating", "approving", "capturing"].includes(
                        checkoutState
                      ) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>
                            {checkoutState === "creating" && "Creating PayPal Order..."}
                            {checkoutState === "approving" && "Authorizing..."}
                            {checkoutState === "capturing" && "Verifying & Capturing..."}
                          </span>
                        </>
                      ) : (
                        <span>
                          Authorize & Pay ${intent.total.toFixed(2)} USD
                        </span>
                      )}
                    </button>
                  ) : (
                    <div className="paypal-button-container">
                      <PayPalScriptProvider
                        options={{
                          clientId: paypalClientId,
                          currency: "USD",
                          intent: "capture",
                        }}
                      >
                        <PayPalButtons
                          style={{
                            layout: "vertical",
                            color: paymentMethod === "card" ? "black" : "gold",
                            shape: "rect",
                            label: "pay",
                            height: 46,
                          }}
                          createOrder={createOrder}
                          onApprove={async (data) => {
                            await captureOrder(data.orderID);
                          }}
                          onError={(err) => {
                            setCheckoutState("error");
                            setErrorMsg(String(err));
                          }}
                          onCancel={() => setCheckoutState("idle")}
                          disabled={["creating", "capturing"].includes(
                            checkoutState
                          )}
                        />
                      </PayPalScriptProvider>
                    </div>
                  )}
                </div>
              )}

              {checkoutState === "error" && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-900 flex-1">{errorMsg}</div>
                </div>
              )}

              {checkoutState === "complete" && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="text-sm font-medium text-emerald-900">
                    Payment captured — redirecting to verified receipt...
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Protected by SHA-256 Cart Lock</span>
                <a
                  href="https://developer.paypal.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-zinc-800"
                >
                  PayPal Orders v2 <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
