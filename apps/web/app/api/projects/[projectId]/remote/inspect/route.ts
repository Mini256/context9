import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/api-auth";
import { openContext9DbSession } from "@/lib/server/context9-db";
import { listSecretEntries } from "@/lib/server/context9-repository";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    await requireApiAccess(request);
    const { projectId } = await context.params;
    const url = new URL(request.url);
    const contextName = url.searchParams.get("contextName");
    const filePath = url.searchParams.get("filePath");

    if (!contextName || !filePath) {
      return NextResponse.json(
        { error: "Missing required query params: contextName and filePath" },
        { status: 400 },
      );
    }

    const session = await openContext9DbSession();
    try {
      const entries = await listSecretEntries(session.prisma, {
        projectId,
        contextName,
        filePath,
      });
      return NextResponse.json({ entries });
    } finally {
      await session.close();
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 },
    );
  }
}
