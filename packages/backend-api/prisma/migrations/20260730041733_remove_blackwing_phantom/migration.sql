-- Cleans up a single phantom `Equipment` row: name = 'blackwing' (lowercase, no
-- "Hat" suffix). Same class of bug as 20260716194214_fix_light_spirit_name_drift:
-- the taxonomy pass matches by exact name, and at some point the Fasterthoughts
-- armor CSV apparently carried this item under a malformed/placeholder name
-- instead of "Blackwing Hat". That created a name-drift phantom carrying rank +
-- category but no drop data, alongside the real junk-sourced "Blackwing Hat" row.
--
-- Unlike the Light Spirit case, the CSV has since self-corrected — it now reads
-- "Blackwing Hat" and matches the real row cleanly, confirmed against the live
-- source as of 2026-07-30. So no `CSV_NAME_ALIASES` entry is needed to stop a
-- recurrence; this migration only needs to clear out the leftover phantom, which
-- the seed's upsert-by-name never deletes on its own.

-- Popular-query logs first, while the phantom still exists to join against.
-- Expected to match zero rows (a phantom has no drop rates, so the Oracle could
-- never have offered it) — this is a safety net, not a repair.
DELETE FROM "PopularJunkOracleQuery" q
WHERE EXISTS (
  SELECT 1
  FROM "PopularJunkOracleQueryTerm" t
  WHERE t."queryId" = q.id
    AND t.kind = 'equipment'
    AND t.key = 'blackwing'
);

-- The phantom row itself. Guarded on having no drop data of its own: if a row
-- named exactly 'blackwing' ever holds real rates, the premise here is wrong —
-- leave it alone and let it surface rather than delete it.
DELETE FROM "Equipment" e
WHERE e.name = 'blackwing'
  AND NOT EXISTS (SELECT 1 FROM "EquipmentDropRate" d WHERE d."equipmentId" = e.id)
  AND NOT EXISTS (SELECT 1 FROM "EquipmentBlessingDropRate" b WHERE b."equipmentId" = e.id);
