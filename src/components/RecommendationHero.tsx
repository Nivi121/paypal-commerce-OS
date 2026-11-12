"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import type { Product, AgentSession } from "@/types/commerce";
import ProductVisual from "@/components/ProductVisual";

interface RecommendationHeroProps {
  session: AgentSession;
  selectedProductId?: string;
  onSelectProduct: (product: Product) => void;
  onProceedToCheckout: (product: Product) => void;
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-600 font-medium">{label}</span>
        <span className="font-bold text-zinc-900 tabular-nums">{value}/100</span>
      </div>
      <div className="h-2.5 neo-inset rounded-full overflow-hidden p-[2px]">
        <div
          className="h-full bg-zinc-800 rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function RecommendationHero({
  session,
  selectedProductId,
  onSelectProduct,
  onProceedToCheckout,
}: RecommendationHeroProps) {
  const [showEliminated, setShowEliminated] = useState(false);

  const ranked = session.ranked || [];
  const activeProduct =
    ranked.find((p) => p.id === selectedProductId) ||
    session.top_pick ||
    ranked[0];

  if (!activeProduct) {
    return (
      <div className="glass-neo-card p-8 text-center text-base text-zinc-500">
        No qualifying products matched all constraints.
      </div>
    );
  }

  const isTopRanked = activeProduct.id === session.top_pick?.id;
  const alternatives = ranked.filter((p) => p.id !== activeProduct.id);
  const savings = session.constraints
    ? session.constraints.max_price_usd - activeProduct.price_usd
    : 0;

  return (
    <div className="space-y-6">
      {/* Selected Product Hero Card */}
      <div className="glass-neo-card p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Product Hardware Visual */}
          <div className="lg:col-span-4">
            <ProductVisual product={activeProduct} size="lg" />
          </div>

          {/* Right: Title, Price & Highlights */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {isTopRanked ? (
                    <span className="tag-success">
                      <Check className="w-3.5 h-3.5" /> Recommended #1 Match
                    </span>
                  ) : (
                    <span className="tag-neutral">Selected Candidate</span>
                  )}
                  {activeProduct.fit_score !== undefined && (
                    <span className="tag-neutral tabular-nums">
                      Fit Score {activeProduct.fit_score.toFixed(1)} / 100
                    </span>
                  )}
                  <span className="text-xs font-mono text-zinc-500">
                    {activeProduct.sku}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 leading-snug">
                  {activeProduct.name}
                </h2>
                <p className="text-sm text-zinc-600">
                  {activeProduct.cpu.model} ({activeProduct.cpu.cores}C/{activeProduct.cpu.threads}T) ·{" "}
                  {activeProduct.ram.size_gb} GB {activeProduct.ram.type} ·{" "}
                  {activeProduct.storage.size_gb} GB {activeProduct.storage.type} · {activeProduct.os}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-3xl font-bold text-zinc-900 tabular-nums">
                  ${activeProduct.price_usd.toFixed(2)}
                </div>
                {activeProduct.original_price_usd &&
                  activeProduct.original_price_usd > activeProduct.price_usd && (
                    <div className="text-sm text-zinc-400 line-through tabular-nums">
                      ${activeProduct.original_price_usd.toFixed(2)}
                    </div>
                  )}
                {session.constraints && (
                  <div
                    className={`text-sm font-semibold mt-1 tabular-nums ${
                      savings >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {savings >= 0
                      ? `$${savings.toFixed(2)} under $${session.constraints.max_price_usd} budget`
                      : `$${Math.abs(savings).toFixed(2)} over $${session.constraints.max_price_usd} budget`}
                  </div>
                )}
              </div>
            </div>

            {/* Strengths & Key Ports */}
            <div className="flex flex-wrap gap-2">
              {activeProduct.review.positive_highlights.map((h) => (
                <span key={h} className="tag-neutral">
                  <Check className="w-3 h-3 text-emerald-700" />
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Spec Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="neo-tile p-4 rounded-xl">
            <div className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
              Memory
            </div>
            <div className="text-base font-bold text-zinc-900 mt-1">
              {activeProduct.ram.size_gb}GB {activeProduct.ram.type}
            </div>
            <div className="text-xs text-zinc-600 mt-0.5">
              {activeProduct.ram.soldered
                ? "Soldered memory"
                : `Upgradeable to ${activeProduct.ram.max_upgradeable_gb}GB`}
            </div>
          </div>

          <div className="neo-tile p-4 rounded-xl">
            <div className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
              Battery
            </div>
            <div className="text-base font-bold text-zinc-900 mt-1">
              {activeProduct.battery.capacity_wh}Wh · {activeProduct.battery.rated_hours}h
            </div>
            <div className="text-xs text-zinc-600 mt-0.5">
              {activeProduct.battery.fast_charge
                ? `${activeProduct.battery.charge_watts}W fast charge`
                : "Standard charge"}
            </div>
          </div>

          <div className="neo-tile p-4 rounded-xl">
            <div className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
              Chassis & Ports
            </div>
            <div className="text-base font-bold text-zinc-900 mt-1">
              {activeProduct.build.material}
            </div>
            <div className="text-xs text-zinc-600 mt-0.5">
              {activeProduct.build.mil_std_810h ? "MIL-STD-810H · " : ""}
              {activeProduct.build.weight_kg} kg
            </div>
          </div>

          <div className="neo-tile p-4 rounded-xl">
            <div className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
              Display & Warranty
            </div>
            <div className="text-base font-bold text-zinc-900 mt-1">
              {activeProduct.display.size_inches}&quot; {activeProduct.display.panel}
            </div>
            <div className="text-xs text-zinc-600 mt-0.5">
              {activeProduct.display.resolution} · {activeProduct.warranty_years}-yr warranty
            </div>
          </div>
        </div>

        {/* Fit Score Breakdown */}
        {activeProduct.fit_score !== undefined && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-3 border-t border-zinc-200/70">
            <MetricRow
              label="Developer Performance (35%)"
              value={activeProduct.dev_performance_score || 0}
            />
            <MetricRow
              label="4-Year Longevity (30%)"
              value={activeProduct.longevity_score || 0}
            />
            <MetricRow
              label="Battery Endurance (20%)"
              value={activeProduct.battery_endurance_score || 0}
            />
            <MetricRow
              label="Budget Efficiency (15%)"
              value={activeProduct.price_delta_score || 0}
            />
          </div>
        )}

        {/* Primary CTA */}
        <div className="pt-3 border-t border-zinc-200/70 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <ShieldCheck className="w-4 h-4 text-zinc-700" />
            <span>
              {activeProduct.review.score}/100 verified score across{" "}
              {activeProduct.review.total_reviews.toLocaleString()} reviews ({activeProduct.review.source})
            </span>
          </div>

          <button
            type="button"
            onClick={() => onProceedToCheckout(activeProduct)}
            className="btn-primary px-6 py-3.5 text-sm"
          >
            <span>
              Continue to Payment — ${activeProduct.price_usd.toFixed(2)}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Qualifying Alternatives */}
      {alternatives.length > 0 && (
        <div className="glass-neo-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">
            Other Qualifying Candidates ({alternatives.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alternatives.map((alt) => (
              <div
                key={alt.id}
                className="neo-tile p-4 rounded-xl flex items-center gap-4"
              >
                <ProductVisual product={alt} size="sm" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-500">#{alt.rank}</span>
                    <span className="text-sm font-semibold text-zinc-900 truncate">
                      {alt.brand} {alt.model}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 truncate">
                    {alt.cpu.model} · {alt.ram.size_gb}GB · {alt.battery.capacity_wh}Wh
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-base font-bold text-zinc-900 tabular-nums">
                      ${alt.price_usd.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectProduct(alt)}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Inspect & Select
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Eliminated Models */}
      {session.eliminated && session.eliminated.length > 0 && (
        <div className="glass-neo-card p-5">
          <button
            type="button"
            onClick={() => setShowEliminated(!showEliminated)}
            className="flex items-center justify-between w-full text-sm font-medium text-zinc-700 hover:text-zinc-900 cursor-pointer"
          >
            <span>
              {session.eliminated.length} disqualified models filtered out during analysis
            </span>
            {showEliminated ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showEliminated && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {session.eliminated.map((p) => (
                <div key={p.id} className="neo-inset p-3.5 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-zinc-900">
                    {p.brand} {p.model}{" "}
                    <span className="text-zinc-500 font-normal tabular-nums">
                      (${p.price_usd.toFixed(2)})
                    </span>
                  </div>
                  <div className="text-red-700 leading-relaxed">
                    {p.elimination_reason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
