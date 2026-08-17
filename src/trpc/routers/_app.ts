import { BoardRouter } from "@/features/board/server/routers/board";
import { ChatRouter } from "@/features/chat/server/routers/chat";
import { DocumentRouter } from "@/features/main/server/routers/document";
import { FolderRouter } from "@/features/main/server/routers/folder";
import { StickyNoteRouter } from "@/features/sticky-notes/server/routers/sticky-note";
import { createTRPCRouter } from "../init";

export const appRouter = createTRPCRouter({
  folder: FolderRouter,
  document: DocumentRouter,
  board: BoardRouter,
  stickyNote: StickyNoteRouter,
  chat: ChatRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
