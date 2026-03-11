import "server-only";

import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "./auth-options";

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function requireApiAccess(request: Request): Promise<{
  mode: "service-token" | "session";
  session?: Session;
}> {
  const configuredToken = process.env.CONTEXT9_SERVICE_TOKEN;
  const incomingToken =
    extractBearerToken(request) ?? request.headers.get("x-context9-api-key");

  if (configuredToken && incomingToken === configuredToken) {
    return {
      mode: "service-token",
    };
  }

  const session = await getServerSession(authOptions);
  if (session) {
    return {
      mode: "session",
      session,
    };
  }

  throw new Error("Unauthorized");
}
