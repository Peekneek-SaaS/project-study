import type { Metadata } from "next";

import { ChatView } from "@/features/chat/views/chat-view";

export const metadata: Metadata = { title: "Chat" };

const ChatPage = () => {
  return <ChatView />;
};

export default ChatPage;
