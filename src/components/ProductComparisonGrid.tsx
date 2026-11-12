"use client";

import { useMemo, useRef, useCallback } from "react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type RowStyle,
} from "ag-grid-community";
import type { Product } from "@/types/commerce";
import { AgGridReact } from "ag-grid-react";

ModuleRegistry.registerModules([AllCommunityModule]);

const aegisLightTheme = themeQuartz.withParams({
  backgroundColor: "#ffffff",
  headerBackgroundColor: "#f4f4f5",
  oddRowBackgroundColor: "#fafafa",
  rowHoverColor: "#f4f4f5",
  borderColor: "#e4e4e7",
  foregroundColor: "#18181b",
  headerTextColor: "#52525b",
  headerHeight: 42,
  rowHeight: 52,
  fontSize: 13,
});

interface ProductComparisonGridProps {
  products: Product[];
  eliminated: Product[];
  topPickId?: string;
}

function FitScoreCell(params: ICellRendererParams<Product>) {
  const score = params.value as number | undefined;
  if (!score) return <span className="text-zinc-400">—</span>;

  return (
    <div className="flex items-center gap-2.5 w-full">
      <span className="text-xs font-semibold text-zinc-900 tabular-nums w-8">
        {score.toFixed(1)}
      </span>
      <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-zinc-800 rounded-full"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function PriceCell(params: ICellRendererParams<Product>) {
  const product = params.data;
  if (!product) return null;
  return (
    <span
      className={`font-semibold tabular-nums ${
        product.eliminated ? "text-zinc-400 line-through" : "text-zinc-900"
      }`}
    >
      ${product.price_usd.toFixed(2)}
    </span>
  );
}

function RAMCell(params: ICellRendererParams<Product>) {
  const product = params.data;
  if (!product) return null;
  const { size_gb, type, soldered } = product.ram;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-900 font-medium">
        {size_gb}GB {type}
      </span>
      <span className={soldered ? "tag-danger" : "tag-success"}>
        {soldered ? "Soldered" : "Upgradeable"}
      </span>
    </div>
  );
}

function BatteryCell(params: ICellRendererParams<Product>) {
  const product = params.data;
  if (!product) return null;
  return (
    <span className="text-zinc-700 tabular-nums">
      {product.battery.capacity_wh}Wh · {product.battery.rated_hours}h
    </span>
  );
}

function StatusCell(params: ICellRendererParams<Product>) {
  const product = params.data;
  if (!product) return null;
  if (product.eliminated) return <span className="tag-danger">Rejected</span>;
  if (product.rank === 1) return <span className="tag-success">#1 Pick</span>;
  return <span className="tag-neutral">#{product.rank || "—"}</span>;
}

export default function ProductComparisonGrid({
  products,
  eliminated,
  topPickId,
}: ProductComparisonGridProps) {
  const gridRef = useRef<AgGridReact<Product>>(null);

  const allRows = useMemo(() => {
    const activeSorted = products
      .filter((p) => !p.eliminated)
      .sort((a, b) => (a.rank || 99) - (b.rank || 99));
    const eliminatedRows = eliminated.map((p) => ({ ...p, eliminated: true }));
    return [...activeSorted, ...eliminatedRows];
  }, [products, eliminated]);

  const columnDefs = useMemo<ColDef<Product>[]>(
    () => [
      {
        field: "rank",
        headerName: "Status",
        width: 105,
        pinned: "left",
        cellRenderer: StatusCell,
        sortable: true,
      },
      {
        field: "name",
        headerName: "Model",
        minWidth: 210,
        flex: 2,
        cellRenderer: (params: ICellRendererParams<Product>) => {
          const p = params.data;
          if (!p) return null;
          return (
            <div className="leading-tight">
              <div
                className={`text-xs font-semibold ${
                  p.eliminated ? "text-zinc-400 line-through" : "text-zinc-900"
                }`}
              >
                {p.brand} {p.model}
              </div>
              <div className="text-[11px] text-zinc-500 truncate max-w-[190px]">
                {p.cpu.model}
              </div>
            </div>
          );
        },
        sortable: true,
        filter: true,
      },
      {
        field: "price_usd",
        headerName: "Price",
        width: 100,
        cellRenderer: PriceCell,
        sortable: true,
      },
      {
        field: "fit_score",
        headerName: "Fit Score",
        width: 145,
        cellRenderer: FitScoreCell,
        sortable: true,
      },
      {
        field: "ram",
        headerName: "Memory",
        width: 185,
        cellRenderer: RAMCell,
        sortable: false,
      },
      {
        field: "battery",
        headerName: "Battery",
        width: 120,
        cellRenderer: BatteryCell,
        sortable: false,
      },
      {
        field: "build.mil_std_810h",
        headerName: "MIL-STD",
        width: 95,
        cellRenderer: (params: ICellRendererParams<Product>) =>
          params.data?.build.mil_std_810h ? (
            <span className="tag-neutral">Yes</span>
          ) : (
            <span className="text-zinc-400 text-xs">No</span>
          ),
        sortable: true,
      },
      {
        field: "elimination_reason",
        headerName: "Filter Note",
        flex: 1,
        minWidth: 220,
        cellRenderer: (params: ICellRendererParams<Product>) => {
          const reason = params.value as string | undefined;
          if (!reason) return <span className="text-zinc-400 text-xs">Passed</span>;
          return <span className="text-xs text-red-700">{reason}</span>;
        },
        sortable: false,
      },
    ],
    []
  );

  const getRowStyle = useCallback(
    (params: { data?: Product }): RowStyle | undefined => {
      if (params.data?.id === topPickId) {
        return { backgroundColor: "#f0fdf4" };
      }
      if (params.data?.eliminated) {
        return { opacity: 0.65 };
      }
      return undefined;
    },
    [topPickId]
  );

  if (allRows.length === 0) {
    return (
      <div className="surface-card h-64 flex items-center justify-center text-zinc-500 text-sm">
        Run a search to populate the comparison table.
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-xl overflow-hidden border border-zinc-200 bg-white"
      style={{ height: "440px" }}
    >
      <AgGridReact<Product>
        ref={gridRef}
        theme={aegisLightTheme}
        rowData={allRows}
        columnDefs={columnDefs}
        getRowStyle={getRowStyle}
        defaultColDef={{
          resizable: true,
          cellStyle: { display: "flex", alignItems: "center" },
        }}
        animateRows={true}
        suppressCellFocus={true}
      />
    </div>
  );
}
