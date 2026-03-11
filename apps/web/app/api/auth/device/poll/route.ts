import { NextResponse } from "next/server";
import { pollDeviceAuthorization } from "@/lib/server/device-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      deviceCode?: string;
    };

    if (!body.deviceCode) {
      return NextResponse.json(
        { error: "Missing required field: deviceCode" },
        { status: 400 },
      );
    }

    const result = await pollDeviceAuthorization(body.deviceCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
