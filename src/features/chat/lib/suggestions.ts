/**
 * What an empty universal chat offers to start with.
 *
 * Shared by the landing page and by a conversation that has not been spoken to
 * yet, because they are the same moment: a box, and nothing said. Two lists
 * would drift, and the drift would be visible — "New Chat" opens one of these
 * surfaces and the sidebar link opens the other.
 *
 * Deliberately about *their* documents rather than about the assistant. Each one
 * demonstrates a different thing it can do — find across documents, summarise
 * one, pull structure out — so the set doubles as an explanation of what the
 * page is for. That matters more than it sounds: an empty chat over a drive full
 * of uploads is a blank-page problem, and people do not discover what a chat can
 * do by being told, they discover it by seeing a question that worked.
 */
export const UNIVERSAL_SUGGESTIONS = [
  "What are my documents about?",
  "Summarise the key concepts I need to revise",
  "Make me a study plan from my documents",
];
