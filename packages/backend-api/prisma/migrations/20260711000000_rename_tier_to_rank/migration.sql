-- Rename the equipment "tier" concept to "rank", matching the in-game term
-- ("Rank"; not to be confused with the adventurer rank). Data-preserving: renames
-- the enum type, its reference table, that table's primary-key constraint, and the
-- Equipment.tier column in place — no drop/recreate, so all rows are kept.

ALTER TYPE "EquipmentTierKind" RENAME TO "EquipmentRankKind";

ALTER TABLE "EquipmentTier" RENAME TO "EquipmentRank";
ALTER TABLE "EquipmentRank" RENAME CONSTRAINT "EquipmentTier_pkey" TO "EquipmentRank_pkey";

ALTER TABLE "Equipment" RENAME COLUMN "tier" TO "rank";
