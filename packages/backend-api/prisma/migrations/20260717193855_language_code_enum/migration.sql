-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('en', 'ja', 'ko', 'de');

-- AlterTable
-- Hand-written: Prisma won't cast a populated, required PK column from text to
-- an enum on its own (it would drop and recreate the column). Postgres can do it
-- in place with USING, since every existing `lang` is already a valid label —
-- the column has only ever been written from the app's own language set. The
-- primary-key index is rebuilt automatically by the type change.
ALTER TABLE "LanguageStatus"
  ALTER COLUMN "lang" TYPE "LanguageCode" USING "lang"::"LanguageCode";
