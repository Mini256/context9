import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/api-auth";
import { openContext9DbSession } from "@/lib/server/context9-db";
import { acquireContextLock } from "@/lib/server/context9-repository";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; contextName: string }> },
) {
  try {
    const auth = await requireApiAccess(request);
    const { projectId, contextName } = await context.params;
    const body = (await request.json()) as {
      owner?: string;
      machineId?: string;
      worktree?: string;
    };

    const owner =
      body.owner ??
      auth.session?.user?.email ??
      auth.session?.user?.name ??
      "context9-service";

    if (!body.machineId || !body.worktree) {
      return NextResponse.json(
        { error: "Missing required fields: machineId and worktree" },
        { status: 400 },
      );
    }

    const session = await openContext9DbSession();
    try {
      const lock = await acquireContextLock(session.prisma, {
        projectId,
        contextName,
        owner,
        machineId: body.machineId,
        worktree: body.worktree,
      });

      return NextResponse.json({ context: lock });
    } finally {
      await session.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      message === "Unauthorized" ? 401 : message.includes("already locked") ? 409 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
