-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT true;
