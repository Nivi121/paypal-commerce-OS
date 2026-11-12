"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Send,
  ChevronRight,
  X,
  ExternalLink,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Download,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Lock,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import PreferenceDrawer from "@/components/PreferenceDrawer";
import AgentStepper from "@/components/AgentStepper";
import ProductComparisonGrid from "@/components/ProductComparisonGrid";
import RecommendationHero from "@/components/RecommendationHero";
import CheckoutApprovalCard from "@/components/CheckoutApprovalCard";
import AuditTrailDrawer from "@/components/AuditTrailDrawer";
import ProductVisual from "@/components/ProductVisual";
import { CATALOG_PRODUCTS } from "@/lib/catalog-data";
import type {
  AgentSession,
  UserPreferences,
  ApiModeStatus,
  Product,
  CheckoutIntent,
  PayPalCaptureResponse,
  ScenarioChip,
} from "@/types/commerce";

type FlowStage = "search" | "products" | "checkout" | "receipt";

const STAGES: Array<{ id: FlowStage; num: string; label: string }> = [
  { id: "search", num: "1", label: "Search & Analysis" },
  { id: "products", num: "2", label: "Product Selection" },
  { id: "checkout", num: "3", label: "Payment & Gateway" },
  { id: "receipt", num: "4", label: "Verified Receipt" },
];

const PRESETS: ScenarioChip[] = [
  {
    id: 1,
    label: "Dev Laptop ≤ $900",
    description: "16GB+ RAM, 4-year longevity",
    goal: "I need a laptop for programming under $900. I want at least 16 GB RAM, good battery life, and something that will last four years.",
    badge: "$900 cap",
    color: "neutral",
  },
  {
    id: 2,
    label: "Spend Policy Block ($1,299)",
    description: "Tests $900 cap enforcement",
    goal: "Force buy the Apple MacBook Pro 14 M3 ($1,299) even though my budget cap is $900.",
    badge: "Policy test",
    color: "danger",
  },
  {
    id: 3,
    label: "Workstation ≤ $1,150",
    description: "32GB RAM for Docker & local models",
    goal: "I need a high-RAM laptop for local LLM inference and Docker under $1,150 with 32GB RAM and aluminum build.",
    badge: "$1,150 cap",
    color: "neutral",
  },
];

const FEATURED_SKUS = [
  "LENOVO-TPE14G6-AMD-16-512",
  "FW13-R7-7840U-16-512",
  "ASUS-PROART-16-R9-32-1TB",
  "APPLE-MBP14-M3-8GB-512",
];

const DEFAULT_PREFERENCES: UserPreferences = {
  budget_cap: 900,
  preferred_brands: [],
  must_have_specs: ["Upgradeable RAM", "DDR5 RAM"],
  longevity_years: 4,
  min_ram_gb: 16,
  use_case: "programming",
};

function ApiModeModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-zinc-900/35 backdrop-blur-xs" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="glass-neo-card p-6 w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-900">Environment & Sandbox Mode</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-200/70 text-zinc-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="neo-inset p-4 rounded-xl text-sm text-zinc-700 leading-relaxed">
            Runs out of the box with zero configuration using RFC-compliant PayPal Sandbox order simulation and the 15-item verified hardware catalog.
          </div>

          <div className="space-y-2 text-xs text-zinc-600">
            <div className="font-semibold text-zinc-800 uppercase tracking-wider">
              Optional Live Variables
            </div>
            <div><code className="text-zinc-900 font-mono">NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> — PayPal Sandbox Client ID</div>
            <div><code className="text-zinc-900 font-mono">PAYPAL_CLIENT_SECRET</code> — PayPal Sandbox Secret</div>
            <div><code className="text-zinc-900 font-mono">CHANNEL3_API_KEY</code> — Channel3 Product Search</div>
            <div><code className="text-zinc-900 font-mono">GEMINI_API_KEY</code> / <code className="text-zinc-900 font-mono">OPENAI_API_KEY</code> — Live LLM parsing</div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <a
              href="https://developer.paypal.com/developer/accounts"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-900"
            >
              PayPal Developer Portal <ExternalLink className="w-3 h-3" />
            </a>
            <button type="button" onClick={onClose} className="btn-primary text-xs py-2">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Home() {
  const [stage, setStage] = useState<FlowStage>("search");
  const [productView, setProductView] = useState<"match" | "matrix">("match");
  const [goal, setGoal] = useState(PRESETS[0].goal);
  const [isRunning, setIsRunning] = useState(false);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [prefDrawerOpen, setPrefDrawerOpen] = useState(false);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [checkoutIntent, setCheckoutIntent] = useState<CheckoutIntent | null>(null);
  const [receipt, setReceipt] = useState<PayPalCaptureResponse | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const featuredProducts = FEATURED_SKUS.map((sku) =>
    CATALOG_PRODUCTS.find((p) => p.sku === sku)
  ).filter((p): p is Product => !!p);

  const goToStage = useCallback((next: FlowStage) => {
    setStage(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("step", next);
      window.history.pushState({ step: next }, "", url.toString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const s = (e.state?.step as FlowStage) || "search";
      setStage(s);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const apiMode: ApiModeStatus = {
    paypal:
      process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID &&
      process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID !== "sb"
        ? "live"
        : "simulation",
    channel3: session?.candidates?.some((c) => c.source === "channel3")
      ? "live"
      : "simulation",
    llm: session?.llm_provider || "deterministic",
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("aegiscart_preferences");
      if (saved) setPreferences(JSON.parse(saved) as UserPreferences);
    } catch { /* ignore */ }
  }, []);

  function buildGoalFromPreferences(prefs: UserPreferences): string {
    const workload = prefs.use_case.replace("_", " ");
    const brandClause =
      prefs.preferred_brands.length > 0
        ? ` Preferred brands: ${prefs.preferred_brands.join(", ")}.`
        : "";
    const specClause =
      prefs.must_have_specs.length > 0
        ? ` Must have: ${prefs.must_have_specs.join(", ")}.`
        : "";
    return `I need a laptop for ${workload} under $${prefs.budget_cap}. I want at least ${prefs.min_ram_gb} GB RAM, good battery life, and something that will last ${prefs.longevity_years} years.${brandClause}${specClause}`;
  }

  function savePreferences(prefs: UserPreferences, syncGoal = false) {
    setPreferences(prefs);
    if (syncGoal) {
      setGoal(buildGoalFromPreferences(prefs));
    }
    try {
      localStorage.setItem("aegiscart_preferences", JSON.stringify(prefs));
    } catch { /* ignore */ }
  }

  const runAgent = useCallback(
    async (
      goalText: string,
      overridePrefs?: UserPreferences,
      applyPreferences = false
    ) => {
      if (!goalText.trim() || isRunning) return;

      const activePrefs = overridePrefs || preferences;
      setIsRunning(true);
      setSession(null);
      setCheckoutProduct(null);
      setCheckoutIntent(null);
      setReceipt(null);

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: goalText,
            session_id: sessionId,
            preferences: activePrefs,
            apply_preferences: applyPreferences,
          }),
        });

        if (!res.ok) throw new Error(`Agent error: ${res.status}`);
        const data = (await res.json()) as AgentSession;
        setSession(data);
        setCheckoutProduct(data.top_pick);
        setCheckoutIntent(data.checkout_intent);
        setProductView("match");

        if (data.scenario === 2) {
          goToStage("checkout");
        } else {
          goToStage("products");
        }
      } catch (err) {
        console.error("Agent failed:", err);
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, preferences, sessionId, goToStage]
  );

  function handlePreset(chip: ScenarioChip) {
    setGoal(chip.goal);
    let nextPrefs = { ...preferences };
    if (chip.id === 2) {
      nextPrefs = { ...preferences, budget_cap: 900, min_ram_gb: 16, use_case: "programming" };
    } else if (chip.id === 3) {
      nextPrefs = { ...preferences, budget_cap: 1150, min_ram_gb: 32, use_case: "ai_inference" };
    } else {
      nextPrefs = { ...preferences, budget_cap: 900, min_ram_gb: 16, use_case: "programming" };
    }
    savePreferences(nextPrefs);
    runAgent(chip.goal, nextPrefs);
  }

  function handleQuickInspect(product: Product) {
    const prompt = `Evaluate ${product.name} ($${product.price_usd}) against my $${preferences.budget_cap} budget cap and ${preferences.min_ram_gb}GB RAM requirement.`;
    setGoal(prompt);
    if (product.sku === "APPLE-MBP14-M3-8GB-512") {
      runAgent(`Force buy the Apple MacBook Pro 14 M3 ($1,299) even though my budget cap is $${preferences.budget_cap}.`);
    } else if (product.ram.size_gb >= 32) {
      const nextPrefs = { ...preferences, budget_cap: 1150, min_ram_gb: 32, use_case: "ai_inference" };
      savePreferences(nextPrefs);
      runAgent(
        "I need a high-RAM laptop for local LLM inference and Docker under $1,150 with 32GB RAM and aluminum build.",
        nextPrefs
      );
    } else {
      runAgent(PRESETS[0].goal);
    }
  }

  function syncPrefsFromGoalText(text: string): UserPreferences {
    const g = text.toLowerCase();
    const priceMatch = g.match(/\$?(\d{3,4})(?:\s*\.00)?/);
    const ramMatch = g.match(/(\d+)\s*gb\s*(?:ram|memory)?/i);
    const nextPrefs = { ...preferences };
    if (priceMatch) {
      const cap = parseInt(priceMatch[1], 10);
      if (cap >= 400 && cap <= 5000 && !g.includes("macbook")) {
        nextPrefs.budget_cap = cap;
      }
    }
    if (ramMatch) {
      const ram = parseInt(ramMatch[1], 10);
      if ([8, 16, 32, 64].includes(ram)) {
        nextPrefs.min_ram_gb = ram;
      }
    }
    savePreferences(nextPrefs, false);
    return nextPrefs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (goal.trim()) {
      const synced = syncPrefsFromGoalText(goal);
      runAgent(goal, synced, false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (goal.trim()) {
        const synced = syncPrefsFromGoalText(goal);
        runAgent(goal, synced, false);
      }
    }
  }

  function handleApplyPolicy(nextPrefs: UserPreferences) {
    const updatedGoal = buildGoalFromPreferences(nextPrefs);
    savePreferences(nextPrefs, true);
    runAgent(updatedGoal, nextPrefs, true);
  }

  async function handleProceedToCheckout(product: Product) {
    setCheckoutProduct(product);
    if (session?.constraints) {
      try {
        const res = await fetch("/api/checkout-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product,
            constraints: session.constraints,
            session_id: sessionId,
          }),
        });
        if (res.ok) {
          const intent = (await res.json()) as CheckoutIntent;
          setCheckoutIntent(intent);
        }
      } catch {
        // fallback to existing intent
      }
    }
    goToStage("checkout");
  }

  function handleResetFlow() {
    setSession(null);
    setCheckoutProduct(null);
    setCheckoutIntent(null);
    setReceipt(null);
    goToStage("search");
  }

  function isStageUnlocked(s: FlowStage): boolean {
    if (s === "search") return true;
    if (s === "products") return !!session;
    if (s === "checkout") return !!session && !!checkoutProduct;
    if (s === "receipt") return !!receipt;
    return false;
  }

  function downloadReceipt() {
    if (!receipt) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            session_id: session?.session_id,
            receipt,
            product: checkoutProduct,
            steps: session?.steps,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegiscart-receipt-${receipt.order_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex flex-col liquid-canvas text-zinc-900 overflow-x-hidden relative">
      {/* Subtle Liquid Morphism Atmospheric Shapes (neutral silver/pearl) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="liquid-blob-1 absolute -top-24 -left-24 w-[420px] h-[420px] opacity-80 blur-2xl" />
        <div className="liquid-blob-2 absolute top-1/3 -right-24 w-[460px] h-[460px] opacity-75 blur-2xl" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          apiMode={apiMode}
          onOpenApiModal={() => setApiModalOpen(true)}
          onOpenPreferences={() => setPrefDrawerOpen(true)}
          onOpenAudit={() => setAuditDrawerOpen(true)}
        />

        {apiModalOpen && <ApiModeModal onClose={() => setApiModalOpen(false)} />}
        <PreferenceDrawer
          open={prefDrawerOpen}
          onClose={() => setPrefDrawerOpen(false)}
          preferences={preferences}
          onChange={(p) => savePreferences(p, true)}
          onApply={handleApplyPolicy}
        />
        <AuditTrailDrawer
          open={auditDrawerOpen}
          onClose={() => setAuditDrawerOpen(false)}
          session={session}
          receipt={receipt}
        />

        {/* Horizontal Guided Stage Bar */}
        <div className="bg-white/55 backdrop-blur-md border-b border-white/80">
          <div className="max-w-7xl mx-auto px-6">
            <nav
              className="flex items-center gap-3 sm:gap-8 overflow-x-auto"
              aria-label="Checkout progress"
            >
              {STAGES.map((item, idx) => {
                const unlocked = isStageUnlocked(item.id);
                const active = stage === item.id;
                return (
                  <div key={item.id} className="flex items-center gap-3 sm:gap-8 shrink-0">
                    <button
                      type="button"
                      disabled={!unlocked}
                      onClick={() => unlocked && goToStage(item.id)}
                      className={`py-3.5 border-b-2 text-sm font-medium flex items-center gap-2.5 transition-colors ${
                        active
                          ? "border-zinc-900 text-zinc-900"
                          : unlocked
                          ? "border-transparent text-zinc-600 hover:text-zinc-900 cursor-pointer"
                          : "border-transparent text-zinc-400 cursor-not-allowed"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                          active
                            ? "bg-zinc-900 text-white shadow-sm"
                            : unlocked
                            ? "neo-tile text-zinc-800"
                            : "bg-zinc-200/60 text-zinc-400"
                        }`}
                      >
                        {item.num}
                      </span>
                      <span>{item.label}</span>
                    </button>
                    {idx < STAGES.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-zinc-400 hidden sm:block" />
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
          {/* ── STAGE 1: SEARCH, CATALOG PREVIEW & FEATURES ──────── */}
          {stage === "search" && (
            <div className="space-y-8">
              {/* Top 12-Col Hero Grid: Prompt Left + Policy/Summary Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Left 7 Cols: Search Input & Presets */}
                <div className="lg:col-span-7 glass-neo-card p-6 sm:p-8 flex flex-col justify-between space-y-5">
                  <div className="space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
                      Hardware Procurement & Verified Checkout
                    </h1>
                    <p className="text-base text-zinc-600 leading-relaxed">
                      State your budget, memory, and durability goals. AegisCart eliminates hardware traps, ranks qualified models, and locks pricing before PayPal authorization.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <textarea
                      ref={inputRef}
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Describe laptop specs, budget, and expected lifespan..."
                      rows={3}
                      className="input-clean w-full resize-none leading-relaxed"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">
                        Press Enter to evaluate 15 authorized catalog devices
                      </span>
                      <button
                        type="submit"
                        disabled={!goal.trim() || isRunning}
                        className="btn-primary px-6 py-3"
                      >
                        {isRunning ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Evaluating Catalog...</span>
                          </>
                        ) : (
                          <>
                            <span>Find & Compare Options</span>
                            <Send className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  <div className="pt-2 space-y-2.5">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Quick Sample Requests
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {PRESETS.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => handlePreset(chip)}
                          disabled={isRunning}
                          className={`p-3.5 rounded-xl text-left transition-all cursor-pointer disabled:opacity-50 ${
                            chip.color === "danger"
                              ? "bg-red-50/80 border border-red-200 hover:bg-red-100/70"
                              : "neo-tile hover:scale-[1.01]"
                          }`}
                        >
                          <div className="text-sm font-semibold text-zinc-900">
                            {chip.label}
                          </div>
                          <div className="text-xs text-zinc-600 mt-1">
                            {chip.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right 5 Cols: Active Policy Guardrails & Live Trace */}
                <div className="lg:col-span-5 glass-neo-card p-6 sm:p-7 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Active Spend Policy
                      </span>
                      <button
                        type="button"
                        onClick={() => setPrefDrawerOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-800 hover:text-zinc-600 cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Edit Policy
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="neo-inset p-4 rounded-xl">
                        <div className="text-xs text-zinc-500">Hard Budget Cap</div>
                        <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1">
                          ${preferences.budget_cap.toLocaleString()}
                        </div>
                      </div>
                      <div className="neo-inset p-4 rounded-xl">
                        <div className="text-xs text-zinc-500">Min Memory</div>
                        <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1">
                          {preferences.min_ram_gb} GB+
                        </div>
                      </div>
                      <div className="neo-inset p-4 rounded-xl">
                        <div className="text-xs text-zinc-500">Target Lifespan</div>
                        <div className="text-lg font-bold text-zinc-900 tabular-nums mt-1">
                          {preferences.longevity_years} Years
                        </div>
                      </div>
                      <div className="neo-inset p-4 rounded-xl">
                        <div className="text-xs text-zinc-500">Workload</div>
                        <div className="text-lg font-bold text-zinc-900 capitalize mt-1">
                          {preferences.use_case.replace("_", " ")}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="neo-tile p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <Lock className="w-4 h-4 text-zinc-700" />
                      <span>Human-in-the-Loop Protection</span>
                    </div>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      Evaluation cannot capture payment automatically. Every order requires your explicit approval, passes a deterministic budget firewall, and binds price + SKU with a SHA-256 cart lock.
                    </p>
                  </div>
                </div>
              </div>

              {/* Execution Trace if Running or Completed */}
              {(isRunning || (session && session.steps.length > 0)) && (
                <div className="glass-neo-card p-6 space-y-4">
                  <AgentStepper steps={session?.steps || []} isRunning={isRunning} />
                  {session && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => goToStage("products")}
                        className="btn-primary"
                      >
                        <span>View Product Selection</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Featured Authorized Hardware Catalog Strip */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">
                      Featured Authorized Store Catalog
                    </h2>
                    <p className="text-sm text-zinc-600">
                      Preview verified laptops with full benchmark, battery, and upgradeability telemetry
                    </p>
                  </div>
                  <span className="tag-neutral">
                    {CATALOG_PRODUCTS.length} verified devices available
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {featuredProducts.map((item) => {
                    const overBudget = item.price_usd > preferences.budget_cap;
                    return (
                      <div
                        key={item.id}
                        className="glass-neo-card p-4 flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-3">
                          <ProductVisual product={item} size="md" />
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                                {item.brand}
                              </span>
                              {overBudget ? (
                                <span className="tag-danger">Over ${preferences.budget_cap}</span>
                              ) : (
                                <span className="tag-success">Within Budget</span>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-zinc-900 leading-snug">
                              {item.model}
                            </h3>
                            <p className="text-xs text-zinc-600 leading-relaxed">
                              {item.cpu.model} · {item.ram.size_gb}GB {item.ram.type} ·{" "}
                              {item.battery.capacity_wh}Wh ({item.battery.rated_hours}h)
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-zinc-200/70 flex items-center justify-between gap-2">
                          <span className="text-lg font-bold text-zinc-900 tabular-nums">
                            ${item.price_usd.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuickInspect(item)}
                            disabled={isRunning}
                            className="btn-secondary text-xs py-2 px-3.5"
                          >
                            Evaluate
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Platform Features Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="glass-neo-card p-6 space-y-2">
                  <div className="text-sm font-bold text-zinc-900">
                    4-Year Longevity Scoring
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    Ranks every device across Developer Performance (35%), Upgradeability & Build Longevity (30%), Battery Endurance (20%), and Budget Savings (15%).
                  </p>
                </div>
                <div className="glass-neo-card p-6 space-y-2">
                  <div className="text-sm font-bold text-zinc-900">
                    Deterministic Spend Firewall
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    Server-side policy code enforces your maximum spend cap before PayPal order creation, blocking over-budget purchases with HTTP 403.
                  </p>
                </div>
                <div className="glass-neo-card p-6 space-y-2">
                  <div className="text-sm font-bold text-zinc-900">
                    PayPal Orders v2 & SHA-256 Lock
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    Generates an idempotent PayPal-Request-Id and verifies a SHA-256 hash of SKU, price, and budget cap prior to payment capture.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── STAGE 2: PRODUCT SELECTION & COMPARISON ───────────── */}
          {stage === "products" && session && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <button
                    type="button"
                    onClick={() => goToStage("search")}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 mb-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Edit search requirements</span>
                  </button>
                  <h1 className="text-2xl font-bold text-zinc-900">
                    Product Selection ({session.ranked.length} Qualified ·{" "}
                    {session.eliminated.length} Filtered Out)
                  </h1>
                </div>

                {/* Tactile Neumorphic Segmented Toggle */}
                <div className="neo-inset inline-flex p-1.5 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setProductView("match")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      productView === "match"
                        ? "neo-tile text-zinc-900 font-semibold"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Recommended Match
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductView("matrix")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      productView === "matrix"
                        ? "neo-tile text-zinc-900 font-semibold"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Comparison Table ({session.candidates.length})
                  </button>
                </div>
              </div>

              {productView === "match" ? (
                <RecommendationHero
                  session={session}
                  selectedProductId={checkoutProduct?.id}
                  onSelectProduct={(p) => setCheckoutProduct(p)}
                  onProceedToCheckout={handleProceedToCheckout}
                />
              ) : (
                <div className="glass-neo-card p-6 space-y-5">
                  <ProductComparisonGrid
                    products={[...(session.ranked || []), ...(session.eliminated || [])]}
                    eliminated={session.eliminated || []}
                    topPickId={checkoutProduct?.id || session.top_pick?.id}
                  />
                  {checkoutProduct && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleProceedToCheckout(checkoutProduct)}
                        className="btn-primary"
                      >
                        <span>
                          Continue to Payment with {checkoutProduct.brand}{" "}
                          {checkoutProduct.model} (${checkoutProduct.price_usd.toFixed(2)})
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STAGE 3: PAYMENT METHOD & GATEWAY ────────────────── */}
          {stage === "checkout" && (
            <div className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => goToStage("products")}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 mb-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Product Selection</span>
                </button>
                <h1 className="text-2xl font-bold text-zinc-900">
                  Checkout & Payment Authorization
                </h1>
              </div>

              <CheckoutApprovalCard
                intent={checkoutIntent}
                product={checkoutProduct}
                sessionId={sessionId}
                onBackToProducts={() => goToStage("products")}
                onCapture={(r) => {
                  setReceipt(r);
                  setSession((prev) =>
                    prev
                      ? {
                          ...prev,
                          capture_receipt: r,
                          steps: prev.steps.map((s) =>
                            s.step === 8
                              ? {
                                  ...s,
                                  status: "completed",
                                  description: `PayPal Capture Completed. Order: ${r.order_id} | Capture: ${r.capture_id} | Amount: $${r.amount} ${r.currency}`,
                                }
                              : s
                          ),
                        }
                      : prev
                  );
                  goToStage("receipt");
                }}
                onFirewallBlock={(msg) => {
                  setSession((prev) =>
                    prev
                      ? {
                          ...prev,
                          steps: prev.steps.map((s) =>
                            s.step === 8
                              ? { ...s, status: "blocked", description: msg }
                              : s
                          ),
                        }
                      : prev
                  );
                }}
              />
            </div>
          )}

          {/* ── STAGE 4: VERIFIED RECEIPT & AUDIT LEDGER ─────────── */}
          {stage === "receipt" && receipt && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="glass-neo-card p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-zinc-900">
                        Order Confirmed & Verified
                      </h1>
                      <p className="text-sm text-zinc-600 mt-0.5">
                        {receipt.simulation_mode
                          ? "Processed via PayPal Sandbox Simulation"
                          : "Processed via PayPal Sandbox API"}{" "}
                        · {new Date(receipt.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className="tag-success">COMPLETED</span>
                </div>

                {checkoutProduct && (
                  <div className="neo-tile p-4 rounded-xl flex flex-wrap items-center gap-4">
                    <ProductVisual product={checkoutProduct} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold text-zinc-900">
                        {checkoutProduct.name}
                      </div>
                      <div className="text-xs text-zinc-600 mt-0.5">
                        SKU: {checkoutProduct.sku} · Merchant: {receipt.merchant_name}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-zinc-900 tabular-nums">
                      ${receipt.amount} {receipt.currency}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
                  <div className="neo-inset p-3.5 rounded-xl flex justify-between gap-2">
                    <span className="text-zinc-500">PayPal Order ID</span>
                    <span className="font-mono font-semibold text-zinc-900">{receipt.order_id}</span>
                  </div>
                  <div className="neo-inset p-3.5 rounded-xl flex justify-between gap-2">
                    <span className="text-zinc-500">Capture ID</span>
                    <span className="font-mono font-semibold text-zinc-900">{receipt.capture_id}</span>
                  </div>
                  <div className="neo-inset p-3.5 rounded-xl flex justify-between gap-2">
                    <span className="text-zinc-500">Idempotency Key</span>
                    <span className="font-mono text-zinc-900 truncate max-w-[200px]">
                      {receipt.idempotency_key}
                    </span>
                  </div>
                  <div className="neo-inset p-3.5 rounded-xl flex justify-between gap-2">
                    <span className="text-zinc-500">SHA-256 Check</span>
                    <span className="font-semibold text-emerald-700 inline-flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" />
                      {receipt.sha256_verified ? "Verified" : "Failed"}
                    </span>
                  </div>
                </div>

                <div className="neo-inset p-4 rounded-xl">
                  <div className="text-xs text-zinc-500 mb-1 font-medium">
                    SHA-256 Cart Integrity Hash
                  </div>
                  <div className="font-mono text-xs text-zinc-800 break-all">
                    {receipt.sha256_lock}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200/70">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={downloadReceipt}
                      className="btn-secondary text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download JSON Receipt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditDrawerOpen(true)}
                      className="btn-secondary text-sm"
                    >
                      Inspect Raw Payloads
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetFlow}
                    className="btn-primary text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Start New Search</span>
                  </button>
                </div>
              </div>

              {session && (
                <div className="glass-neo-card p-6">
                  <AgentStepper steps={session.steps} isRunning={false} />
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
