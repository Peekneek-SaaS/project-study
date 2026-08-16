import { defineConfig } from "@trigger.dev/sdk";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "proj_tjmjqxlorcjurblsrifn",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    // Prisma 7 with the `prisma-client` provider and a driver adapter: the
    // generated client is TypeScript in `src/generated/prisma` and bundles
    // fine, but its runtime carries a WASM query compiler that does not, so
    // the extension marks `@prisma/client` external for us.
    //
    // The generated client is gitignored, so a deploy needs `prisma generate`
    // to have run first — which `postinstall` handles.
    extensions: [prismaExtension({ mode: "modern" })],
    // The adapter and its driver are installed in the run environment rather
    // than bundled, so they resolve the same native/optional pieces they would
    // locally.
    external: ["@prisma/adapter-pg", "pg"],
  },
});
