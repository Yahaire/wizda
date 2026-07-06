-- CreateEnum
CREATE TYPE "StatKind" AS ENUM ('ATK', 'MAG', 'DIV', 'ACC', 'EVA', 'RES', 'DEF', 'MDEF', 'ASPD', 'SUR');

-- CreateEnum
CREATE TYPE "GearTypeKind" AS ENUM ('WEAPON', 'SHIELD', 'HELMET', 'GLOVES', 'CHEST_ARMOR', 'BOOTS', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "GearTier" AS ENUM ('BRONZE', 'STEEL', 'EBONSTEEL', 'SILVER');

-- CreateTable
CREATE TABLE "Stat" (
    "kind" "StatKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Stat_pkey" PRIMARY KEY ("kind")
);

-- CreateTable
CREATE TABLE "Blessing" (
    "code" TEXT NOT NULL,
    "statKind" "StatKind" NOT NULL,
    "isPercent" BOOLEAN NOT NULL,

    CONSTRAINT "Blessing_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "GearType" (
    "kind" "GearTypeKind" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "GearType_pkey" PRIMARY KEY ("kind")
);

-- CreateTable
CREATE TABLE "EquipmentCategory" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gearType" "GearTypeKind" NOT NULL,

    CONSTRAINT "EquipmentCategory_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "GearTier",
    "maxDropQuality" INTEGER,
    "maxDropGrade" INTEGER,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Junk" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Junk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentDropRate" (
    "id" TEXT NOT NULL,
    "junkId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "groupDropRate" DOUBLE PRECISION NOT NULL,
    "dropRate" DOUBLE PRECISION NOT NULL,
    "groupNumber" INTEGER,
    "quality1Rate" DOUBLE PRECISION NOT NULL,
    "quality2Rate" DOUBLE PRECISION NOT NULL,
    "quality3Rate" DOUBLE PRECISION NOT NULL,
    "quality4Rate" DOUBLE PRECISION NOT NULL,
    "quality5Rate" DOUBLE PRECISION NOT NULL,
    "grade1Rate" DOUBLE PRECISION NOT NULL,
    "grade2Rate" DOUBLE PRECISION NOT NULL,
    "grade3Rate" DOUBLE PRECISION NOT NULL,
    "grade4Rate" DOUBLE PRECISION NOT NULL,
    "grade5Rate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "EquipmentDropRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentBlessingDropRate" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "blessingCode" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "EquipmentBlessingDropRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Blessing_statKind_isPercent_key" ON "Blessing"("statKind", "isPercent");

-- CreateIndex
CREATE INDEX "EquipmentCategory_gearType_idx" ON "EquipmentCategory"("gearType");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_name_key" ON "Equipment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Junk_name_key" ON "Junk"("name");

-- CreateIndex
CREATE INDEX "EquipmentDropRate_junkId_idx" ON "EquipmentDropRate"("junkId");

-- CreateIndex
CREATE INDEX "EquipmentDropRate_equipmentId_idx" ON "EquipmentDropRate"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentBlessingDropRate_blessingCode_idx" ON "EquipmentBlessingDropRate"("blessingCode");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentBlessingDropRate_equipmentId_slot_blessingCode_key" ON "EquipmentBlessingDropRate"("equipmentId", "slot", "blessingCode");

-- AddForeignKey
ALTER TABLE "Blessing" ADD CONSTRAINT "Blessing_statKind_fkey" FOREIGN KEY ("statKind") REFERENCES "Stat"("kind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentCategory" ADD CONSTRAINT "EquipmentCategory_gearType_fkey" FOREIGN KEY ("gearType") REFERENCES "GearType"("kind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentDropRate" ADD CONSTRAINT "EquipmentDropRate_junkId_fkey" FOREIGN KEY ("junkId") REFERENCES "Junk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentDropRate" ADD CONSTRAINT "EquipmentDropRate_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBlessingDropRate" ADD CONSTRAINT "EquipmentBlessingDropRate_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBlessingDropRate" ADD CONSTRAINT "EquipmentBlessingDropRate_blessingCode_fkey" FOREIGN KEY ("blessingCode") REFERENCES "Blessing"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
