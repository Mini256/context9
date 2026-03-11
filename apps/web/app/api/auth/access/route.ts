import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/api-auth";

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(request);
    return NextResponse.json({
      ok: true,
      mode: access.mode,
      user: access.session?.user ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 401 },
    );
  }
}
