-- Where a conversation's durable run can be picked back up.
--
-- Answering moved out of the request and into a Trigger.dev chat agent, so a
-- turn now outlives the tab that started it. These are what let any later tab
-- reattach to that run and watch the rest of the answer stream, rather than
-- finding a finished reply with no sign of how it got there.
ALTER TABLE "Chat" ADD COLUMN "sessionRunId" TEXT;
ALTER TABLE "Chat" ADD COLUMN "lastEventId" TEXT;
ALTER TABLE "Chat" ADD COLUMN "sessionToken" TEXT;
