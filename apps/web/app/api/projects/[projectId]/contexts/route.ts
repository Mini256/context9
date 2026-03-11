import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/api-auth";
import { openContext9DbSession } from "@/lib/server/context9-db";
import { ensureContext, listContexts } from "@/lib/server/context9-repository";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    await requireApiAccess(request);
    const { projectId } = await context.params;
    const session = await openContext9DbSession();

    try {
      const contexts = await listContexts(session.prisma, projectId);
      return NextResponse.json({ contexts });
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

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    await requireApiAccess(request);
    const { projectId } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      branchName?: string;
    };

    if (!body.name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 },
      );
    }

    const session = await openContext9DbSession();
    try {
      const created = await ensureContext(session.prisma, {
        projectId,
        contextName: body.name,
        branchName: body.branchName,
      });

      return NextResponse.json({ context: created }, { status: 201 });
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
