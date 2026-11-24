import { NextRequest, NextResponse } from "next/server";
import { CHANGE_ERROR_STATUS, validateChange } from "@/lib/plan-change";
import {
  PaddleRejectedError,
  applyPlanChange,
  changeRequestContext,
  undoScheduledChange,
} from "@/lib/plan-change-service";

export async function POST(req: NextRequest) {
  const context = await changeRequestContext(req.headers);
  if (!context.ok) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  const body = (await req.json().catch(() => ({}))) as {
    priceId?: unknown;
    extensions?: unknown;
  };
  const change = validateChange({
    row: context.row,
    priceId: body.priceId,
    extensions: body.extensions,
  });
  if (!change.ok) {
    return NextResponse.json({ error: change.error }, { status: CHANGE_ERROR_STATUS[change.error] });
  }
  try {
    return NextResponse.json(await applyPlanChange(context.row!, context.viewer, change));
  } catch (error) {
    if (error instanceof PaddleRejectedError) {
      return NextResponse.json({ error: "PADDLE_REJECTED" }, { status: 502 });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const context = await changeRequestContext(req.headers);
  if (!context.ok) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (!context.row) {
    return NextResponse.json({ error: "NO_PENDING_CHANGE" }, { status: 409 });
  }
  try {
    const result = await undoScheduledChange(context.row, context.viewer.id);
    if (result !== "ok") {
      return NextResponse.json({ error: result }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PaddleRejectedError) {
      return NextResponse.json({ error: "PADDLE_REJECTED" }, { status: 502 });
    }
    throw error;
  }
}
