import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/api-auth";
import { openContext9DbSession } from "@/lib/server/context9-db";
import {
  syncTrackedDefinitions,
  upsertProject,
  type ApiTrackedFile,
} from "@/lib/server/context9-repository";

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    await requireApiAccess(request);
    const { projectId } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      rootHint?: string;
      defaultBranch?: string;
      files?: ApiTrackedFile[];
    };

    if (!body.name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 },
      );
    }

    const session = await openContext9DbSession();
    try {
      const project = await upsertProject(session.prisma, {
        projectId,
        name: body.name,
        rootHint: body.rootHint,
        defaultBranch: body.defaultBranch,
      });

      if (body.files?.length) {
        await syncTrackedDefinitions(session.prisma, {
          projectId,
          files: body.files,
        });
      }

      return NextResponse.json({ project });
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
