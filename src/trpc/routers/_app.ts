import { DocumentRouter } from "@/features/main/server/routers/document";
import { FolderRouter } from "@/features/main/server/routers/folder";
import { createTRPCRouter } from "../init";

export const appRouter = createTRPCRouter({
  folder: FolderRouter,
  document: DocumentRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
