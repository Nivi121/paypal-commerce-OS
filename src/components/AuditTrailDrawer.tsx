"use client";

import { useState } from "react";
import {
  X,
  CheckCircle2,
  Download,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import type { AgentSession, PayPalCaptureResponse } from "@/types/commerce";

interface AuditTrailDrawerProps {
  session: AgentSession | null;
  receipt: PayPalCaptureResponse | null;
  open: boolean;
  onClose: () => void;
}

function CopyBtn({ text }: { text: string }) {
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
    >
      {copied ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function JsonViewer({ data }: { data: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const json = JSON.stringify(data, null, 2);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-zinc-50">
        <span className="text-xs font-mono text-zinc-600">Payload</span>
        <div className="flex items-center gap-1">
          <CopyBtn text={json} />
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-zinc-200 text-zinc-500 cursor-pointer"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {expanded ? (
        <pre className="code-block max-h-64 rounded-none">{json}</pre>
      ) : (
        <div className="px-3 py-2 font-mono text-xs text-zinc-500 truncate">
          {JSON.stringify(data).slice(0, 110)}...
        </div>
      )}
    </div>
  );
}

function AuditRow({
  label,
  value,
  mono = false,
  good = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  good?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-zinc-100 last:border-0">
      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
      <div className="flex items-center gap-1 overflow-hidden">
        <span
          className={`text-xs text-right break-all ${mono ? "font-mono" : ""} ${
            good ? "text-emerald-700 font-medium" : "text-zinc-900"
          }`}
        >
          {value}
        </span>
        {mono && <CopyBtn text={value} />}
      </div>
    </div>
  );
}

export default function AuditTrailDrawer({
  session,
  receipt,
  open,
  onClose,
}: AuditTrailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"receipt" | "toolcalls" | "json">("receipt");

  if (!open) return null;

  function handleDownload() {
    const data = {
      session_id: session?.session_id,
      timestamp: new Date().toISOString(),
      receipt,
      steps: session?.steps,
      constraints: session?.constraints,
      top_pick: session?.top_pick,
      checkout_intent: session?.checkout_intent,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegiscart-audit-${session?.session_id?.slice(0, 8) || "session"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-zinc-900/30 backdrop-blur-[1px]" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 z-50 w-[500px] max-w-full bg-white border-l border-zinc-200 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900">Transaction Audit Log</span>
            {receipt && <span className="tag-success">Verified</span>}
          </div>
          <div className="flex items-center gap-2">
            {receipt && (
              <button
                type="button"
                onClick={handleDownload}
                className="btn-secondary text-xs py-1.5 px-2.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-zinc-200 px-5 gap-6">
          {(["receipt", "toolcalls", "json"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === tab
                  ? "text-zinc-900 border-zinc-900"
                  : "text-zinc-500 border-transparent hover:text-zinc-800"
              }`}
            >
              {tab === "receipt" ? "PayPal Receipt" : tab === "toolcalls" ? "Execution Steps" : "Raw Payloads"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-zinc-50">
          {activeTab === "receipt" && (
            <>
              {!receipt ? (
                <div className="surface-card p-8 text-center">
                  <p className="text-sm font-medium text-zinc-700">No payment captured yet</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Approve checkout to generate a verified PayPal receipt.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div className="text-xs text-emerald-900">
                      <span className="font-semibold">Payment Verified</span> —{" "}
                      {receipt.simulation_mode
                        ? "PayPal Sandbox Simulation"
                        : "Live PayPal Sandbox API"}
                    </div>
                  </div>

                  <div className="surface-card p-4">
                    <AuditRow label="Order ID" value={receipt.order_id} mono />
                    <AuditRow label="Capture ID" value={receipt.capture_id} mono />
                    <AuditRow label="Idempotency Key" value={receipt.idempotency_key} mono />
                    <AuditRow label="Status" value={receipt.status} good={receipt.status === "COMPLETED"} />
                    <AuditRow label="Amount" value={`${receipt.amount} ${receipt.currency}`} good />
                    <AuditRow label="SHA-256 Cart Hash" value={receipt.sha256_lock} mono />
                    <AuditRow
                      label="Integrity Check"
                      value={receipt.sha256_verified ? "Verified" : "Hash mismatch"}
                      good={receipt.sha256_verified}
                    />
                    <AuditRow label="Merchant" value={receipt.merchant_name} />
                    <AuditRow label="Timestamp" value={new Date(receipt.timestamp).toLocaleString()} />
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "toolcalls" && (
            <div className="space-y-2.5">
              {!session ? (
                <div className="surface-card p-8 text-center text-xs text-zinc-500">
                  No session recorded yet.
                </div>
              ) : (
                session.steps.map((step) => (
                  <div key={step.step} className="surface-card p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-900">
                        {step.step}. {step.title}
                      </span>
                      <span className="text-zinc-500 font-mono">{step.status}</span>
                    </div>
                    {step.description && (
                      <p className="text-xs text-zinc-600 leading-relaxed">{step.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "json" && (
            <div className="space-y-3">
              {receipt && <JsonViewer data={receipt} />}
              {session?.checkout_intent && <JsonViewer data={session.checkout_intent} />}
              {session?.constraints && <JsonViewer data={session.constraints} />}
              {!receipt && !session && (
                <div className="surface-card p-8 text-center text-xs text-zinc-500">
                  Run a search to inspect JSON payloads.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
