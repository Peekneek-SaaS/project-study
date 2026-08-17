-- Moves `DocumentChunk.searchVector` from a generated column to a plain one
-- kept up to date by a trigger.
--
-- The generated column was the right thing for Postgres and the wrong thing for
-- Prisma. The migration engine reads `GENERATED ALWAYS AS ...` as a column
-- default; the datamodel declares no default, so every `migrate dev` diffed the
-- two and emitted `ALTER COLUMN "searchVector" DROP DEFAULT` — which Postgres
-- rejects outright on a generated column (error 42601). That is not a one-off:
-- it would have been regenerated on every future migration, because the
-- database held something the schema had no way to describe.
--
-- A trigger holds the same guarantee — the vector is recomputed from `text` on
-- every insert and update, so it can never be stale, and application code still
-- cannot write it — while being completely invisible to Prisma's differ. The
-- index moves into the schema for the opposite reason: an index Prisma does not
-- know about is one it drops, which is exactly what happened to the first one.

-- `IF EXISTS` so this is safe on a database where the expression has already
-- gone, and on a fresh one replaying the migration that created it. Values are
-- retained — this drops the rule, not the data.
ALTER TABLE "DocumentChunk" ALTER COLUMN "searchVector" DROP EXPRESSION IF EXISTS;

-- 'english' is fixed rather than per-document, and must stay in step with the
-- `websearch_to_tsquery('english', ...)` in `retrieval.ts`: a vector and a query
-- built with different dictionaries do not match each other.
CREATE OR REPLACE FUNCTION "document_chunk_search_vector"() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', COALESCE(NEW."text", ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "document_chunk_search_vector_trg" ON "DocumentChunk";

-- `BEFORE`, so the value is written as part of the row rather than by a second
-- update of it. `OF "text"` narrows the update case to the only column the
-- vector is derived from — re-tokenising a passage because its `section` label
-- changed would be work for no difference.
CREATE TRIGGER "document_chunk_search_vector_trg"
BEFORE INSERT OR UPDATE OF "text" ON "DocumentChunk"
FOR EACH ROW EXECUTE FUNCTION "document_chunk_search_vector"();

-- Anything written while the column had no rule behind it. Ordinarily nothing:
-- dropping the expression keeps the values it had already computed.
UPDATE "DocumentChunk"
SET "searchVector" = to_tsvector('english', COALESCE("text", ''))
WHERE "searchVector" IS NULL;

-- Dropped and recreated rather than created, so this lands the same way on a
-- database whose index survived and on one whose index was already dropped by
-- the failed migration. From here it is declared in `schema.prisma`, so Prisma
-- owns it and will leave it alone.
DROP INDEX IF EXISTS "DocumentChunk_searchVector_idx";
CREATE INDEX "DocumentChunk_searchVector_idx" ON "DocumentChunk" USING GIN ("searchVector");
