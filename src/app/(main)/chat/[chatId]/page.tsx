import type { Metadata } from "next";

import { ChatConversationView } from "@/features/chat/views/chat-conversation-view";
import { getQueryClient, trpc } from "@/trpc/server";

/**
 * The conversation's own title in the tab, the way the board and work pages do
 * it.
 *
 * Falls back to "Chat" rather than failing, because this runs for chats that do
 * not exist yet: the id is minted in the browser and the row is written by the
 * first question, so a page opened from the landing page has nothing to look up
 * at the moment this is called.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ chatId: string }>;
}): Promise<Metadata> {
  const { chatId } = await params;

  const chat = await getQueryClient()
    .fetchQuery(trpc.chat.get.queryOptions({ id: chatId }))
    .catch(() => null);

  return { title: chat?.title ?? "Chat" };
}

const ChatConversationPage = async ({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) => {
  const { chatId } = await params;

  return <ChatConversationView chatId={chatId} />;
};

export default ChatConversationPage;
