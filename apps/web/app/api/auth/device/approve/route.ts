import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth-options";
import { approveDeviceAuthorization } from "@/lib/server/device-auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      userCode?: string;
    };

    if (!body.userCode) {
      return NextResponse.json(
        { error: "Missing required field: userCode" },
        { status: 400 },
      );
    }

    const result = await approveDeviceAuthorization({
      userCode: body.userCode,
      email,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Device code not found."
          ? 404
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
