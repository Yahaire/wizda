-- CreateEnum
CREATE TYPE "BlessingValueSelectorKind" AS ENUM ('RANK_RANGE', 'NAMED', 'CATEGORY', 'FALLBACK', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "blessingValueGroupCode" TEXT;

-- CreateTable
CREATE TABLE "BlessingValueSource" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "BlessingValueSource_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "BlessingValueGroup" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "rankOrderMin" INTEGER NOT NULL,
    "rankOrderMax" INTEGER NOT NULL,
    "selectorKind" "BlessingValueSelectorKind" NOT NULL,
    "selectorTokens" TEXT[],

    CONSTRAINT "BlessingValueGroup_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "BlessingValueRate" (
    "id" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "blessingCode" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BlessingValueRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlessingValueBonus" (
    "id" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "blessingCode" TEXT NOT NULL,
    "minValue" INTEGER NOT NULL,
    "probabilities" DOUBLE PRECISION[],
    "isVerified" BOOLEAN NOT NULL,
    "verificationNote" TEXT,

    CONSTRAINT "BlessingValueBonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlessingValueRate_blessingCode_idx" ON "BlessingValueRate"("blessingCode");

-- CreateIndex
CREATE UNIQUE INDEX "BlessingValueRate_groupCode_sourceCode_quality_blessingCode_key" ON "BlessingValueRate"("groupCode", "sourceCode", "quality", "blessingCode", "value");

-- CreateIndex
CREATE UNIQUE INDEX "BlessingValueBonus_groupCode_quality_blessingCode_key" ON "BlessingValueBonus"("groupCode", "quality", "blessingCode");

-- CreateIndex
CREATE INDEX "Equipment_blessingValueGroupCode_idx" ON "Equipment"("blessingValueGroupCode");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_blessingValueGroupCode_fkey" FOREIGN KEY ("blessingValueGroupCode") REFERENCES "BlessingValueGroup"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlessingValueRate" ADD CONSTRAINT "BlessingValueRate_groupCode_fkey" FOREIGN KEY ("groupCode") REFERENCES "BlessingValueGroup"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlessingValueRate" ADD CONSTRAINT "BlessingValueRate_sourceCode_fkey" FOREIGN KEY ("sourceCode") REFERENCES "BlessingValueSource"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlessingValueRate" ADD CONSTRAINT "BlessingValueRate_blessingCode_fkey" FOREIGN KEY ("blessingCode") REFERENCES "Blessing"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlessingValueBonus" ADD CONSTRAINT "BlessingValueBonus_groupCode_fkey" FOREIGN KEY ("groupCode") REFERENCES "BlessingValueGroup"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlessingValueBonus" ADD CONSTRAINT "BlessingValueBonus_blessingCode_fkey" FOREIGN KEY ("blessingCode") REFERENCES "Blessing"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
