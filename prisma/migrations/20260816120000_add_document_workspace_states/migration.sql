-- Splits the old catch-all `PROCESSING` into the two states a document is
-- actually in while its workspace is built: `QUEUED` (row written, job handed
-- to Trigger.dev) and `BUILDING` (job running). `PROCESSING` is dropped rather
-- than kept as an alias — nothing ever wrote it, so no row can be holding it.
--
-- Postgres can add enum values in place but not remove one, so the type is
-- rebuilt and the column swapped over. The default is dropped first because a
-- column default referencing the old type would block the rename.

-- AlterEnum
BEGIN;
CREATE TYPE "DocumentStatus_new" AS ENUM ('UPLOADING', 'QUEUED', 'BUILDING', 'READY', 'FAILED');
ALTER TABLE "Document" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Document" ALTER COLUMN "status" TYPE "DocumentStatus_new" USING ("status"::text::"DocumentStatus_new");
ALTER TYPE "DocumentStatus" RENAME TO "DocumentStatus_old";
ALTER TYPE "DocumentStatus_new" RENAME TO "DocumentStatus";
DROP TYPE "DocumentStatus_old";
ALTER TABLE "Document" ALTER COLUMN "status" SET DEFAULT 'UPLOADING';
COMMIT;
