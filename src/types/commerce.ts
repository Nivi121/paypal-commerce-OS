// ============================================================
// AegisCart AI — Strict TypeScript Type Definitions
// ============================================================

export interface ShoppingConstraints {
  max_price_usd: number;
  min_ram_gb: number;
  category: string;
  use_case: string;
  min_battery_wh?: number;
  min_cpu_generation?: string;
  ram_type?: string[];
  chassis_material?: string[];
  mil_std?: boolean;
  upgradeable_ram?: boolean;
  preferred_brands?: string[];
  longevity_years?: number;
  min_storage_gb?: number;
  gpu_required?: boolean;
}

export interface CPUSpec {
  brand: "AMD" | "Intel" | "Apple" | "Qualcomm";
  model: string;
  generation: string;
  cores: number;
  threads: number;
  base_ghz: number;
  boost_ghz: number;
  tdp_w: number;
  benchmark_score: number; // Cinebench R23 Multi
  architecture: string; // e.g. "Zen 4", "Raptor Lake", "M3"
  node_nm: number; // fabrication node
}

export interface RAMSpec {
  size_gb: number;
  type: "DDR4" | "DDR5" | "LPDDR5" | "LPDDR5X" | "LPDDR4X" | "Unified";
  speed_mhz: number;
  soldered: boolean;
  max_upgradeable_gb: number;
  slots: number;
}

export interface StorageSpec {
  size_gb: number;
  type: "NVMe Gen3" | "NVMe Gen4" | "NVMe Gen5" | "SATA SSD" | "eMMC";
  read_mbps: number;
  write_mbps: number;
  upgradeable: boolean;
}

export interface BatterySpec {
  capacity_wh: number;
  rated_hours: number;
  fast_charge: boolean;
  charge_watts: number;
}

export interface DisplaySpec {
  size_inches: number;
  resolution: string;
  panel: "IPS" | "OLED" | "VA" | "TN" | "Mini-LED" | "Liquid Retina";
  refresh_hz: number;
  nits: number;
  color_gamut_pct: number; // sRGB %
  touch: boolean;
}

export interface BuildSpec {
  material: "Aluminum" | "Magnesium Alloy" | "Plastic" | "Carbon Fiber" | "Glass";
  mil_std_810h: boolean;
  weight_kg: number;
  thickness_mm: number;
  ports: string[];
}

export interface ReviewSentiment {
  score: number; // 0–100
  total_reviews: number;
  positive_highlights: string[];
  negative_highlights: string[];
  source: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  price_usd: number;
  original_price_usd?: number;
  image_url: string;
  affiliate_url: string;
  cpu: CPUSpec;
  ram: RAMSpec;
  storage: StorageSpec;
  battery: BatterySpec;
  display: DisplaySpec;
  build: BuildSpec;
  os: string;
  warranty_years: number;
  review: ReviewSentiment;
  availability: "In Stock" | "Limited" | "Pre-Order" | "Out of Stock";
  source: "catalog" | "channel3";
  // Scoring (populated by scoring engine)
  fit_score?: number;
  dev_performance_score?: number;
  longevity_score?: number;
  battery_endurance_score?: number;
  price_delta_score?: number;
  elimination_reason?: string;
  eliminated?: boolean;
  rank?: number;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type AgentStepStatus = "pending" | "running" | "completed" | "error" | "blocked";

export interface ToolCallLog {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  latency_ms: number;
  timestamp: string;
}

export interface AgentStep {
  step: number;
  title: string;
  description: string;
  status: AgentStepStatus;
  tool?: string;
  latency_ms?: number;
  timestamp?: string;
  details?: string;
  tool_calls?: ToolCallLog[];
  products_found?: number;
  products_eliminated?: number;
  products_ranked?: number;
}

export interface CheckoutIntent {
  product: Product;
  item_price: number;
  shipping: number;
  tax: number;
  total: number;
  currency: "USD";
  budget_cap: number;
  budget_savings: number;
  idempotency_key: string;
  sha256_lock: string;
  spend_firewall_status: "APPROVED" | "BLOCKED";
  spend_firewall_message?: string;
  merchant_name: string;
  created_at: string;
}

export interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{ href: string; rel: string; method: string }>;
  create_time?: string;
  idempotency_key: string;
  sha256_lock: string;
}

export interface PayPalCaptureResponse {
  order_id: string;
  capture_id: string;
  status: "COMPLETED" | "PENDING" | "DECLINED" | "FAILED";
  amount: string;
  currency: string;
  payer_email?: string;
  payer_name?: string;
  merchant_name: string;
  idempotency_key: string;
  sha256_lock: string;
  sha256_verified: boolean;
  timestamp: string;
  raw_capture?: Record<string, unknown>;
  simulation_mode: boolean;
}

export interface AuditLogEntry {
  id: string;
  event_type: "TOOL_CALL" | "SPEND_FIREWALL" | "PAYPAL_ORDER" | "PAYPAL_CAPTURE" | "SYSTEM";
  timestamp: string;
  data: Record<string, unknown>;
  sha256_hash?: string;
}

export interface AgentSession {
  session_id: string;
  scenario: 1 | 2 | 3;
  goal: string;
  constraints: ShoppingConstraints;
  steps: AgentStep[];
  candidates: Product[];
  eliminated: Product[];
  ranked: Product[];
  top_pick: Product | null;
  checkout_intent: CheckoutIntent | null;
  capture_receipt: PayPalCaptureResponse | null;
  audit_log: AuditLogEntry[];
  created_at: string;
  completed_at?: string;
  mode: "live_llm" | "deterministic_fallback";
  llm_provider?: "gemini" | "openai";
}

export interface UserPreferences {
  budget_cap: number;
  preferred_brands: string[];
  must_have_specs: string[];
  longevity_years: number;
  min_ram_gb: number;
  use_case: string;
}

export interface ScenarioChip {
  id: 1 | 2 | 3;
  label: string;
  description: string;
  goal: string;
  badge: string;
  color: string;
}

export interface ApiModeStatus {
  paypal: "live" | "simulation";
  channel3: "live" | "simulation";
  llm: "gemini" | "openai" | "deterministic";
  paypal_client_id?: string;
}

export interface SpendFirewallResult {
  approved: boolean;
  price: number;
  budget_cap: number;
  overage?: number;
  sha256_lock: string;
  idempotency_key: string;
  timestamp: string;
  error_code?: "SPEND_FIREWALL_BLOCKED";
  message: string;
}

export type WorkspaceTab = "recommendation" | "grid" | "audit";
