// ============================================================
// AegisCart AI — Channel3 API Client
// Live search + seamless fallback to Sandbox Catalogue
// ============================================================

import type { Product } from "@/types/commerce";
import { CATALOG_PRODUCTS } from "@/lib/catalog-data";

const CHANNEL3_BASE_URL = "https://api.trychannel3.com/v1";

interface Channel3Product {
  id: string;
  title: string;
  price: number;
  currency: string;
  brand?: string;
  category?: string;
  image_url?: string;
  url?: string;
  description?: string;
  specs?: Record<string, string | number | boolean>;
  rating?: number;
  review_count?: number;
  in_stock?: boolean;
}

interface Channel3Response {
  products: Channel3Product[];
  total: number;
  query: string;
}

function mapChannel3ToProduct(c3: Channel3Product, index: number): Product {
  return {
    id: `c3-${c3.id || index}`,
    sku: `C3-${(c3.id || index).toString().toUpperCase()}`,
    name: c3.title,
    brand: c3.brand || "Unknown",
    model: c3.title,
    category: c3.category || "laptop",
    price_usd: c3.price,
    image_url: c3.image_url || "/products/placeholder.jpg",
    affiliate_url: c3.url || "#",
    cpu: {
      brand: "Intel",
      model: String(c3.specs?.cpu || "Unknown CPU"),
      generation: "Unknown",
      cores: Number(c3.specs?.cores || 4),
      threads: Number(c3.specs?.threads || 8),
      base_ghz: Number(c3.specs?.base_ghz || 2.0),
      boost_ghz: Number(c3.specs?.boost_ghz || 4.0),
      tdp_w: Number(c3.specs?.tdp_w || 15),
      benchmark_score: Number(c3.specs?.benchmark_score || 8000),
      architecture: String(c3.specs?.architecture || "Unknown"),
      node_nm: Number(c3.specs?.node_nm || 10),
    },
    ram: {
      size_gb: Number(c3.specs?.ram_gb || 8),
      type: (c3.specs?.ram_type as "DDR4" | "DDR5") || "DDR4",
      speed_mhz: Number(c3.specs?.ram_speed_mhz || 3200),
      soldered: Boolean(c3.specs?.ram_soldered || false),
      max_upgradeable_gb: Number(c3.specs?.max_ram_gb || 32),
      slots: Number(c3.specs?.ram_slots || 2),
    },
    storage: {
      size_gb: Number(c3.specs?.storage_gb || 256),
      type: (c3.specs?.storage_type as "NVMe Gen3" | "NVMe Gen4" | "SATA SSD") || "NVMe Gen3",
      read_mbps: Number(c3.specs?.storage_read_mbps || 3500),
      write_mbps: Number(c3.specs?.storage_write_mbps || 2800),
      upgradeable: Boolean(c3.specs?.storage_upgradeable !== false),
    },
    battery: {
      capacity_wh: Number(c3.specs?.battery_wh || 50),
      rated_hours: Number(c3.specs?.battery_hours || 8),
      fast_charge: Boolean(c3.specs?.fast_charge || false),
      charge_watts: Number(c3.specs?.charge_watts || 65),
    },
    display: {
      size_inches: Number(c3.specs?.display_size || 15.6),
      resolution: String(c3.specs?.resolution || "1920x1080"),
      panel: (c3.specs?.panel_type as "IPS" | "OLED") || "IPS",
      refresh_hz: Number(c3.specs?.refresh_hz || 60),
      nits: Number(c3.specs?.nits || 300),
      color_gamut_pct: Number(c3.specs?.color_gamut_pct || 72),
      touch: Boolean(c3.specs?.touch || false),
    },
    build: {
      material: (c3.specs?.material as "Aluminum" | "Plastic") || "Plastic",
      mil_std_810h: Boolean(c3.specs?.mil_std || false),
      weight_kg: Number(c3.specs?.weight_kg || 1.8),
      thickness_mm: Number(c3.specs?.thickness_mm || 20),
      ports: ["USB-A", "USB-C", "HDMI"],
    },
    os: String(c3.specs?.os || "Windows 11"),
    warranty_years: Number(c3.specs?.warranty_years || 1),
    review: {
      score: Math.round((c3.rating || 4) * 20),
      total_reviews: c3.review_count || 100,
      positive_highlights: ["Channel3 sourced"],
      negative_highlights: [],
      source: "Channel3 API",
    },
    availability: c3.in_stock ? "In Stock" : "Limited",
    source: "channel3",
  };
}

export async function searchChannel3(
  query: string,
  maxResults = 10
): Promise<{ products: Product[]; source: "live" | "fallback" }> {
  const apiKey = process.env.CHANNEL3_API_KEY;

  if (!apiKey) {
    console.info("[Channel3] No API key — using catalog fallback");
    return { products: [], source: "fallback" };
  }

  try {
    const url = new URL(`${CHANNEL3_BASE_URL}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(maxResults));
    url.searchParams.set("category", "laptop");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Client": "AegisCart-AI/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(`[Channel3] API error ${response.status}: ${errText}`);
      return { products: [], source: "fallback" };
    }

    const data: Channel3Response = await response.json();
    const products = (data.products || []).map(mapChannel3ToProduct);
    console.info(`[Channel3] Live: found ${products.length} products`);
    return { products, source: "live" };
  } catch (err) {
    console.warn("[Channel3] Fetch failed — using catalog fallback:", err);
    return { products: [], source: "fallback" };
  }
}

export async function hybridSearch(
  query: string,
  categoryFilter = "laptop",
  maxResults = 12
): Promise<{ products: Product[]; channel3Live: boolean }> {
  // 1. Try Channel3 live API
  const { products: liveProducts, source } = await searchChannel3(query, 6);

  // 2. Always include our controlled catalog (never fail)
  const catalogMatches = CATALOG_PRODUCTS.filter((p) => {
    const q = query.toLowerCase();
    return (
      p.category.toLowerCase().includes(categoryFilter.toLowerCase()) ||
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q)
    );
  }).slice(0, maxResults);

  // 3. Merge: live results first, then catalog (deduplicate by SKU)
  const seen = new Set<string>();
  const merged: Product[] = [];

  for (const p of [...liveProducts, ...catalogMatches]) {
    if (!seen.has(p.sku)) {
      seen.add(p.sku);
      merged.push(p);
    }
  }

  return {
    products: merged.slice(0, maxResults),
    channel3Live: source === "live",
  };
}

