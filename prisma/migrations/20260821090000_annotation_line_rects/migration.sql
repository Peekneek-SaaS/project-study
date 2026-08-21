-- AlterTable
-- Additive and nullable: existing annotations keep rendering from their
-- bounding box until they are rewritten.
ALTER TABLE "DocumentAnnotation" ADD COLUMN "rects" JSONB;
