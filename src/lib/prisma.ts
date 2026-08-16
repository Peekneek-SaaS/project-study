import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // Built here rather than handed to `PrismaPg` as a connection string, so the
  // pool is ours to configure and to listen to.
  //
  // The database is reached through Prisma's pooler, which hangs up on
  // connections it considers spent. A `pg` pool that has not noticed will hand
  // the dead socket to the next query, which is the "Connection terminated
  // unexpectedly" that surfaces as a rejected tRPC call. Retiring our own
  // clients on a timer, and keeping the live ones warm, means this side is the
  // one deciding when a connection ends.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Retire connections well before anything upstream loses patience with
    // them, checked as they go idle so a query is never cut off mid-flight.
    maxLifetimeSeconds: 60 * 5,
    keepAlive: true,
  });

  // A client that dies while sitting idle reports it here rather than at a
  // query. Without a listener `pg` re-throws it as an uncaught exception and
  // takes the server down; the pool has already discarded the client by the
  // time we hear about it, so there is nothing to do but note it and carry on.
  pool.on("error", (error) => {
    console.error("[prisma] idle client error", error);
  });

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Dev reloads re-evaluate this module. Without the cache each one would leave
// its pool behind holding connections, and the pooler starts refusing new ones
// long before the sockets are collected.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
