"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { AgentStep } from "@/types/commerce";

interface AgentStepperProps {
  steps: AgentStep[];
  isRunning: boolean;
}

function StatusIcon({ status }: { status: AgentStep["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />;
    case "running":
      return <Loader2 className="w-4 h-4 text-zinc-900 animate-spin shrink-0" />;
    case "error":
      return <XCircle className="w-4 h-4 text-red-700 shrink-0" />;
    case "blocked":
      return <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />;
    default:
      return <Circle className="w-4 h-4 text-zinc-300 shrink-0" />;
  }
}

export default function AgentStepper({ steps, isRunning }: AgentStepperProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const totalSteps = 8;

  if (steps.length === 0 && !isRunning) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs font-medium text-zinc-500">
          Verification pipeline idle
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          Submit a requirement above to trace all 8 execution steps.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          {isRunning ? "Running Checks..." : "Execution Pipeline"}
        </span>
        <span className="text-xs text-zinc-500 tabular-nums">
          {completedCount}/{totalSteps} completed
        </span>
      </div>

      <div className="h-1 bg-zinc-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-zinc-900 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / totalSteps) * 100}%` }}
        />
      </div>

      <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl bg-white overflow-hidden">
        {steps.map((step) => {
          const isExpanded = expanded === step.step;
          return (
            <div
              key={step.step}
              className={step.status === "blocked" ? "bg-red-50/50" : "bg-white"}
            >
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-zinc-50 transition-colors cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : step.step)}
              >
                <StatusIcon status={step.status} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 font-mono tabular-nums">
                      0{step.step}
                    </span>
                    <span className="text-xs font-medium text-zinc-900 truncate">
                      {step.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                    {step.tool && <span className="font-mono">{step.tool}</span>}
                    {step.latency_ms !== undefined && step.status === "completed" && (
                      <span className="tabular-nums">{step.latency_ms}ms</span>
                    )}
                    {step.products_found !== undefined && (
                      <span>{step.products_found} items</span>
                    )}
                    {step.products_eliminated !== undefined && (
                      <span className="text-red-700">
                        {step.products_eliminated} rejected
                      </span>
                    )}
                  </div>
                </div>

                {step.description && (
                  <span className="text-zinc-400 shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </span>
                )}
              </button>

              {isExpanded && step.description && (
                <div className="px-3.5 pb-3 pt-1 border-t border-zinc-100 bg-zinc-50/70">
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
