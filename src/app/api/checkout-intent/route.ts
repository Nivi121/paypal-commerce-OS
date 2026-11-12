import { NextRequest, NextResponse } from "next/server";
import { buildCheckoutIntent } from "@/lib/scoring-engine";
import type { Product, ShoppingConstraints } from "@/types/commerce";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      product: Product;
      constraints: ShoppingConstraints;
      session_id: string;
    };

    if (!body.product || !body.constraints || !body.session_id) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const intent = buildCheckoutIntent(body.product, body.constraints, body.session_id);
    return NextResponse.json(intent);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to build checkout intent", details: String(err) },
      { status: 500 }
    );
  }
}

