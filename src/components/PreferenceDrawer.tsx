"use client";

import { useState, useEffect } from "react";
import { X, Plus, Minus } from "lucide-react";
import type { UserPreferences } from "@/types/commerce";

interface PreferenceDrawerProps {
  open: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onChange: (prefs: UserPreferences) => void;
  onApply?: (prefs: UserPreferences) => void;
}

const BRANDS = ["Lenovo", "ASUS", "HP", "Dell", "Acer", "Samsung", "Framework", "Apple", "MSI"];
const MUST_HAVE_OPTIONS = [
  "Upgradeable RAM",
  "MIL-STD-810H",
  "DDR5 RAM",
  "NVMe Gen4 SSD",
  "Thunderbolt 4",
  "Fast Charging",
  "Linux Compatible",
];

export default function PreferenceDrawer({
  open,
  onClose,
  preferences,
  onChange,
  onApply,
}: PreferenceDrawerProps) {
  const [localPrefs, setLocalPrefs] = useState<UserPreferences>(preferences);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences, open]);

  function update(key: keyof UserPreferences, value: UserPreferences[keyof UserPreferences]) {
    const updated = { ...localPrefs, [key]: value };
    setLocalPrefs(updated);
    onChange(updated);
  }

  function toggleBrand(brand: string) {
    const brands = localPrefs.preferred_brands.includes(brand)
      ? localPrefs.preferred_brands.filter((b) => b !== brand)
      : [...localPrefs.preferred_brands, brand];
    update("preferred_brands", brands);
  }

  function toggleSpec(spec: string) {
    const specs = localPrefs.must_have_specs.includes(spec)
      ? localPrefs.must_have_specs.filter((s) => s !== spec)
      : [...localPrefs.must_have_specs, spec];
    update("must_have_specs", specs);
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-zinc-900/30 backdrop-blur-[1px]" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-white border-l border-zinc-200 shadow-xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <span className="text-sm font-semibold text-zinc-900">Spend Policy & Constraints</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Maximum Budget Cap
            </label>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold text-zinc-900 tabular-nums">
                ${localPrefs.budget_cap.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-500">USD</span>
            </div>
            <input
              type="range"
              min={500}
              max={2000}
              step={50}
              value={localPrefs.budget_cap}
              onChange={(e) => update("budget_cap", parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-zinc-200 rounded-full appearance-none cursor-pointer accent-zinc-900"
            />
            <div className="flex justify-between text-xs text-zinc-400 mt-1 tabular-nums">
              <span>$500</span>
              <span>$2,000</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Minimum RAM
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[8, 16, 32, 64].map((gb) => (
                <button
                  key={gb}
                  type="button"
                  onClick={() => update("min_ram_gb", gb)}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    localPrefs.min_ram_gb === gb
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-50 text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  {gb}GB
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Primary Workload
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["programming", "ai_inference", "workstation", "general"].map((uc) => (
                <button
                  key={uc}
                  type="button"
                  onClick={() => update("use_case", uc)}
                  className={`py-2 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                    localPrefs.use_case === uc
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-50 text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  {uc.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Expected Lifespan
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => update("longevity_years", Math.max(1, localPrefs.longevity_years - 1))}
                className="p-2 rounded-lg bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 text-center">
                <span className="text-xl font-bold text-zinc-900 tabular-nums">
                  {localPrefs.longevity_years}
                </span>
                <span className="text-sm text-zinc-500 ml-1">years</span>
              </div>
              <button
                type="button"
                onClick={() => update("longevity_years", Math.min(10, localPrefs.longevity_years + 1))}
                className="p-2 rounded-lg bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Preferred Manufacturers
            </label>
            <div className="flex flex-wrap gap-1.5">
              {BRANDS.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => toggleBrand(brand)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    localPrefs.preferred_brands.includes(brand)
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Required Specs
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MUST_HAVE_OPTIONS.map((spec) => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => toggleSpec(spec)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    localPrefs.must_have_specs.includes(spec)
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-zinc-200 bg-zinc-50 space-y-3">
          <p className="text-xs text-zinc-500">
            Saved locally and enforced deterministically before any PayPal order is created.
          </p>
          <button
            type="button"
            onClick={() => {
              onChange(localPrefs);
              if (onApply) onApply(localPrefs);
              onClose();
            }}
            className="btn-primary w-full"
          >
            Apply Policy & Update Search
          </button>
        </div>
      </div>
    </>
  );
}
