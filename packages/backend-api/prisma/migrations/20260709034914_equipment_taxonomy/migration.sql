/*
  Warnings:

  - The `tier` column on the `Equipment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `gearType` on the `EquipmentCategory` table. All the data in the column will be lost.
  - You are about to drop the `GearType` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `equipmentType` to the `EquipmentCategory` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EquipmentTypeKind" AS ENUM ('WEAPON', 'SHIELD', 'HELMET', 'GLOVES', 'CHEST_ARMOR', 'BOOTS', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "EquipmentTierKind" AS ENUM ('WORN', 'BRONZE', 'IRON', 'STEEL', 'EBONSTEEL', 'SILVER');

-- DropForeignKey
ALTER TABLE "EquipmentCategory" DROP CONSTRAINT "EquipmentCategory_gearType_fkey";

-- DropIndex
DROP INDEX "EquipmentCategory_gearType_idx";

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "categoryCode" TEXT,
DROP COLUMN "tier",
ADD COLUMN     "tier" "EquipmentTierKind";

-- AlterTable
ALTER TABLE "EquipmentCategory" DROP COLUMN "gearType",
ADD COLUMN     "equipmentType" "EquipmentTypeKind" NOT NULL;

-- DropTable
DROP TABLE "GearType";

-- DropEnum
DROP TYPE "GearTier";

-- DropEnum
DROP TYPE "GearTypeKind";

-- CreateTable
CREATE TABLE "EquipmentType" (
    "kind" "EquipmentTypeKind" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("kind")
);

-- CreateTable
CREATE TABLE "EquipmentTier" (
    "kind" "EquipmentTierKind" NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "isObtainableThroughJunk" BOOLEAN NOT NULL,

    CONSTRAINT "EquipmentTier_pkey" PRIMARY KEY ("kind")
);

-- CreateIndex
CREATE INDEX "Equipment_categoryCode_idx" ON "Equipment"("categoryCode");

-- CreateIndex
CREATE INDEX "EquipmentCategory_equipmentType_idx" ON "EquipmentCategory"("equipmentType");

-- AddForeignKey
ALTER TABLE "EquipmentCategory" ADD CONSTRAINT "EquipmentCategory_equipmentType_fkey" FOREIGN KEY ("equipmentType") REFERENCES "EquipmentType"("kind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "EquipmentCategory"("code") ON DELETE SET NULL ON UPDATE CASCADE;
