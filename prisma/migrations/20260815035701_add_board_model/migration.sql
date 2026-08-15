-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Untitled Board',
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Board_documentId_key" ON "Board"("documentId");

-- CreateIndex
CREATE INDEX "Board_userId_documentId_idx" ON "Board"("userId", "documentId");

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
