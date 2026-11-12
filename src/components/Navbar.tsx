"use client";

import { ShieldCheck, SlidersHorizontal, FileText } from "lucide-react";
import type { ApiModeStatus } from "@/types/commerce";

interface NavbarProps {
  apiMode: ApiModeStatus;
  onOpenApiModal: () => void;
  onOpenPreferences: () => void;
  onOpenAudit: () => void;
}

export default function Navbar({
  apiMode,
  onOpenApiModal,
  onOpenPreferences,
  onOpenAudit,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 h-16 shrink-0 bg-white/70 backdrop-blur-xl border-b border-white/80 shadow-[0_4px_20px_rgba(163,173,189,0.16)]">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0 shadow-[3px_3px_8px_rgba(24,24,27,0.22),-2px_-2px_6px_rgba(255,255,255,0.8)]">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-base font-bold text-zinc-900 tracking-tight">
              AegisCart
            </span>
            <span className="hidden sm:inline text-sm text-zinc-500">
              Verified Procurement & PayPal Checkout
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenApiModal}
            className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl neo-tile text-xs font-medium text-zinc-700 cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                apiMode.paypal === "live" ? "bg-emerald-600" : "bg-zinc-500"
              }`}
            />
            <span>
              PayPal: {apiMode.paypal === "live" ? "Sandbox Live" : "Simulation"}
            </span>
            <span className="text-zinc-300">|</span>
            <span>
              Catalog: {apiMode.channel3 === "live" ? "Channel3" : "Authorized Store"}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenAudit}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl neo-tile text-xs font-semibold text-zinc-800 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-600" />
            <span className="hidden sm:inline">Audit Log</span>
          </button>

          <button
            type="button"
            onClick={onOpenPreferences}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl neo-tile text-xs font-semibold text-zinc-800 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-600" />
            <span>Spend Policy</span>
          </button>
        </div>
      </div>
    </header>
  );
}
