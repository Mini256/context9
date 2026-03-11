import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var context9Prisma:
    | {
        databaseUrl: string;
        client: PrismaClient;
      }
    | undefined;
}

export function getPrismaClient(databaseUrl: string): PrismaClient {
  if (
    !globalThis.context9Prisma ||
    globalThis.context9Prisma.databaseUrl !== databaseUrl
  ) {
    const adapter = new PrismaPg({ connectionString: databaseUrl }, {
      schema: "context9",
    });

    globalThis.context9Prisma = {
      databaseUrl,
      client: new PrismaClient({
        adapter,
      }),
    };
  }

  return globalThis.context9Prisma.client;
}
