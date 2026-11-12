"use client";

import type { Product } from "@/types/commerce";

interface ProductVisualProps {
  product: Product;
  size?: "sm" | "md" | "lg";
}

function getBrandPalette(brand: string, model: string) {
  const b = brand.toLowerCase();
  const m = model.toLowerCase();

  if (b === "lenovo" && m.includes("thinkpad")) {
    return {
      chassis: "#18181b",
      chassisEdge: "#27272a",
      bezel: "#09090b",
      screenTop: "#27272a",
      screenBottom: "#18181b",
      accentDot: "#dc2626", // Iconic TrackPoint
      keyboard: "#27272a",
      badgeText: "THINKPAD",
    };
  }
  if (b === "apple") {
    return {
      chassis: "#27272a",
      chassisEdge: "#3f3f46",
      bezel: "#09090b",
      screenTop: "#3f3f46",
      screenBottom: "#18181b",
      accentDot: null,
      keyboard: "#18181b",
      badgeText: "MACBOOK PRO",
    };
  }
  if (b === "framework") {
    return {
      chassis: "#d4d4d8",
      chassisEdge: "#e4e4e7",
      bezel: "#18181b",
      screenTop: "#52525b",
      screenBottom: "#27272a",
      accentDot: "#d97706",
      keyboard: "#3f3f46",
      badgeText: "MODULAR 13",
    };
  }
  if (b === "asus" && m.includes("proart")) {
    return {
      chassis: "#1f2937",
      chassisEdge: "#374151",
      bezel: "#09090b",
      screenTop: "#334155",
      screenBottom: "#0f172a",
      accentDot: null,
      keyboard: "#111827",
      badgeText: "PROART OLED",
    };
  }
  if (b === "samsung") {
    return {
      chassis: "#a1a1aa",
      chassisEdge: "#d4d4d8",
      bezel: "#18181b",
      screenTop: "#3f3f46",
      screenBottom: "#18181b",
      accentDot: null,
      keyboard: "#52525b",
      badgeText: "GALAXY BOOK4",
    };
  }
  return {
    chassis: "#71717a",
    chassisEdge: "#a1a1aa",
    bezel: "#18181b",
    screenTop: "#3f3f46",
    screenBottom: "#18181b",
    accentDot: null,
    keyboard: "#27272a",
    badgeText: brand.toUpperCase(),
  };
}

export default function ProductVisual({ product, size = "md" }: ProductVisualProps) {
  const palette = getBrandPalette(product.brand, product.model);
  const heightClass =
    size === "sm" ? "h-20 w-28" : size === "lg" ? "h-48 w-full" : "h-36 w-full";

  return (
    <div
      className={`${heightClass} neo-inset rounded-xl flex items-center justify-center relative overflow-hidden p-3 select-none`}
    >
      {/* Subtle studio floor reflection */}
      <div
        className="absolute inset-x-6 bottom-2 h-3 rounded-full blur-md opacity-25 pointer-events-none"
        style={{ background: "#18181b" }}
      />

      {/* Top corner spec chip */}
      {size !== "sm" && (
        <div className="absolute top-2.5 left-3 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-white/80 backdrop-blur-sm border border-white text-[10px] font-semibold tracking-wider text-zinc-700 shadow-xs">
            {palette.badgeText}
          </span>
        </div>
      )}

      {size !== "sm" && (
        <div className="absolute top-2.5 right-3">
          <span className="px-2 py-0.5 rounded-md bg-zinc-900/80 text-[10px] font-medium text-white">
            {product.display.size_inches}&quot; {product.display.panel}
          </span>
        </div>
      )}

      {/* Vector Hardware Render */}
      <svg
        viewBox="0 0 240 140"
        className={size === "sm" ? "w-20 h-14" : size === "lg" ? "w-56 h-36" : "w-44 h-28"}
        aria-label={product.name}
      >
        <defs>
          <linearGradient id={`screen-${product.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette.screenTop} />
            <stop offset="100%" stopColor={palette.screenBottom} />
          </linearGradient>
          <linearGradient id={`deck-${product.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.chassisEdge} />
            <stop offset="100%" stopColor={palette.chassis} />
          </linearGradient>
        </defs>

        {/* Laptop Lid / Bezel */}
        <rect
          x="36"
          y="12"
          width="168"
          height="92"
          rx="7"
          fill={palette.bezel}
          stroke={palette.chassisEdge}
          strokeWidth="1.5"
        />
        {/* Active Display Area */}
        <rect
          x="42"
          y="18"
          width="156"
          height="80"
          rx="3"
          fill={`url(#screen-${product.id})`}
        />
        {/* Subtle Screen Spec Lines */}
        <rect x="52" y="28" width="54" height="5" rx="2.5" fill="rgba(255,255,255,0.28)" />
        <rect x="52" y="38" width="96" height="3.5" rx="1.75" fill="rgba(255,255,255,0.14)" />
        <rect x="52" y="46" width="76" height="3.5" rx="1.75" fill="rgba(255,255,255,0.12)" />
        <rect x="52" y="64" width="40" height="22" rx="3" fill="rgba(255,255,255,0.08)" />
        <rect x="98" y="64" width="40" height="22" rx="3" fill="rgba(255,255,255,0.08)" />
        <rect x="144" y="64" width="44" height="22" rx="3" fill="rgba(255,255,255,0.08)" />

        {/* Webcam Dot */}
        <circle cx="120" cy="15" r="1.2" fill="#52525b" />

        {/* Base / Keyboard Deck */}
        <polygon
          points="32,104 208,104 226,125 14,125"
          fill={`url(#deck-${product.id})`}
        />
        {/* Keyboard Recessed Grid */}
        <polygon
          points="48,107 192,107 200,117 40,117"
          fill={palette.keyboard}
          opacity="0.85"
        />
        {/* TrackPoint if ThinkPad / Framework dot */}
        {palette.accentDot && (
          <circle cx="120" cy="112" r="2.2" fill={palette.accentDot} />
        )}
        {/* Trackpad */}
        <polygon
          points="96,119 144,119 147,123 93,123"
          fill="rgba(255,255,255,0.12)"
        />
        {/* Front Lip */}
        <rect
          x="14"
          y="125"
          width="212"
          height="5"
          rx="2.5"
          fill={palette.chassis}
        />
        {/* Notch */}
        <rect x="106" y="125" width="28" height="2" rx="1" fill="rgba(255,255,255,0.22)" />
      </svg>
    </div>
  );
}

