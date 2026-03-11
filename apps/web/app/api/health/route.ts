import { NextResponse } from "next/server";
import { openContext9DbSession } from "@/lib/server/context9-db";

export async function GET() {
  try {
    const session = await openContext9DbSession();
    await session.prisma.$queryRaw`select 1`;
    await session.close();

    return NextResponse.json({
      ok: true,
      remoteDatabaseId: session.databaseId,
      authMode: session.authMode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
