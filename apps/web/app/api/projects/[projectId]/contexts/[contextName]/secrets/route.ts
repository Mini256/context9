import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/api-auth";
import { openContext9DbSession } from "@/lib/server/context9-db";
import {
  ensureContext,
  listSecretEntries,
  syncTrackedDefinitions,
  type ApiEncryptedEntry,
  type ApiTrackedFile,
  upsertProject,
  upsertSecretEntries,
} from "@/lib/server/context9-repository";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; contextName: string }> },
) {
  try {
    await requireApiAccess(request);
    const { projectId, contextName } = await context.params;
    const url = new URL(request.url);
    const filePath = url.searchParams.get("filePath") ?? undefined;
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

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string; contextName: string }> },
) {
  try {
    await requireApiAccess(request);
    const { projectId, contextName } = await context.params;
    const body = (await request.json()) as {
      project?: {
        name?: string;
        rootHint?: string;
        defaultBranch?: string;
      };
      files?: ApiTrackedFile[];
      entries?: Omit<ApiEncryptedEntry, "updated_at">[];
      branchName?: string;
    };

    if (!body.project?.name) {
      return NextResponse.json(
        { error: "Missing required field: project.name" },
        { status: 400 },
      );
    }

    const session = await openContext9DbSession();
    try {
      await upsertProject(session.prisma, {
        projectId,
        name: body.project.name,
        rootHint: body.project.rootHint,
        defaultBranch: body.project.defaultBranch,
      });

      if (body.files?.length) {
        await syncTrackedDefinitions(session.prisma, {
          projectId,
          files: body.files,
        });
      }

      await ensureContext(session.prisma, {
        projectId,
        contextName,
        branchName: body.branchName,
      });

      const uploadedEntries = await upsertSecretEntries(session.prisma, {
        projectId,
        entries: body.entries ?? [],
      });

      return NextResponse.json({
        uploadedEntries,
        uploadedFiles: body.files?.length ?? 0,
      });
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
