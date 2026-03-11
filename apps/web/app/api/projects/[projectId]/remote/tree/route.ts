import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/api-auth";
import { openContext9DbSession } from "@/lib/server/context9-db";
import { listRemoteTree } from "@/lib/server/context9-repository";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    await requireApiAccess(request);
    const { projectId } = await context.params;
    const session = await openContext9DbSession();

    try {
      const tree = await listRemoteTree(session.prisma, projectId);
      return NextResponse.json({ tree });
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
