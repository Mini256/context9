import "server-only";

import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "./auth-options";
import { getUserForApiToken } from "./device-auth";

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function requireApiAccess(request: Request): Promise<{
  mode: "service-token" | "api-token" | "session";
  session?: Session;
  user?: {
    email: string;
    name?: string;
  };
}> {
  const configuredToken = process.env.CONTEXT9_SERVICE_TOKEN;
  const incomingToken =
    extractBearerToken(request) ?? request.headers.get("x-context9-api-key");

  if (configuredToken && incomingToken === configuredToken) {
    return {
      mode: "service-token",
    };
  }

  if (incomingToken) {
    const user = await getUserForApiToken(incomingToken);
    if (user) {
      return {
        mode: "api-token",
        user: {
          email: user.email,
          name: user.name,
        },
      };
    }
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
