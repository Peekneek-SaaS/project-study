-- AlterTable
ALTER TABLE "Todo" ADD COLUMN     "documentId" TEXT;

-- CreateIndex
CREATE INDEX "Todo_userId_documentId_dueDate_idx" ON "Todo"("userId", "documentId", "dueDate");

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
