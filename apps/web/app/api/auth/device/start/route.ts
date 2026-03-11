import { NextResponse } from "next/server";
import { createDeviceAuthorization } from "@/lib/server/device-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      machineId?: string;
      hostname?: string;
      clientName?: string;
    };
    const baseUrl =
      process.env.NEXTAUTH_URL ?? new URL(request.url).origin;
    const result = await createDeviceAuthorization({
      apiBaseUrl: baseUrl,
      machineId: body.machineId,
      hostname: body.hostname,
      clientName: body.clientName,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
