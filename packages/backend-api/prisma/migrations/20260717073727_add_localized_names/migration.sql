-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "nameDe" TEXT,
ADD COLUMN     "nameJa" TEXT,
ADD COLUMN     "nameKo" TEXT;

-- AlterTable
ALTER TABLE "Junk" ADD COLUMN     "nameDe" TEXT,
ADD COLUMN     "nameJa" TEXT,
ADD COLUMN     "nameKo" TEXT;

-- CreateTable
CREATE TABLE "LanguageStatus" (
    "lang" TEXT NOT NULL,
    "isInSync" BOOLEAN NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LanguageStatus_pkey" PRIMARY KEY ("lang")
);
