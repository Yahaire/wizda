-- Cleans up after a name drift between our two sources: the Fasterthoughts
-- taxonomy CSVs spell five Light Spirit pieces with a stray "the" ("Headcloth of
-- the Light Spirit") that the gacha-rate pages — and the game — omit. The taxonomy
-- pass matches equipment by exact name, so each of these cost us twice: the real
-- junk-sourced row never got its rank/category (it showed as "unknown tier"), and
-- the CSV spelling was created as a phantom duplicate carrying the rank but no
-- drop rates.
--
-- The seed no longer produces these — `CSV_NAME_ALIASES` in
-- equipmentTaxonomy.mapping.ts now rewrites the CSV names before the lookup. But
-- the seed only ever *upserts* `Equipment` by name and never deletes, so phantoms
-- created by earlier seeds survive a reseed and need clearing out here.
--
-- Note the CSV is inconsistent rather than following a convention: its own "Cloak
-- of Light Spirit" and "Light Spirit Amulet", from the same block, omit the
-- article and matched correctly all along. Only these five are affected.

-- Popular-query logs first, while the phantoms still exist to join against.
--
-- Any logged query naming a phantom is junk data: the Oracle only offers gear
-- with drop rates, so a phantom could never be selected in the first place. Both
-- the term rows and the query's `signature` (a JSON blob embedding the equipment
-- names) would need rewriting to be salvaged, and the count would be meaningless
-- anyway — so drop the whole combo. Terms cascade via the FK. Expected to match
-- zero rows; this is a safety net, not a repair.
DELETE FROM "PopularJunkOracleQuery" q
WHERE EXISTS (
  SELECT 1
  FROM "PopularJunkOracleQueryTerm" t
  WHERE t."queryId" = q.id
    AND t.kind = 'equipment'
    AND t.key IN (
      'Headcloth of the Light Spirit',
      'Heavy Helm of the Light Spirit',
      'Heavy Mail of the Light Spirit',
      'Helm of the Light Spirit',
      'Mail of the Light Spirit'
    )
);

-- The phantom rows themselves. Guarded on having no drop data of their own: these
-- were created by the taxonomy pass and carry nothing but a name, rank and
-- category, so a row under one of these names holding real rates would mean the
-- premise here is wrong — leave it alone and let it surface rather than delete it.
DELETE FROM "Equipment" e
WHERE e.name IN (
  'Headcloth of the Light Spirit',
  'Heavy Helm of the Light Spirit',
  'Heavy Mail of the Light Spirit',
  'Helm of the Light Spirit',
  'Mail of the Light Spirit'
)
  AND NOT EXISTS (SELECT 1 FROM "EquipmentDropRate" d WHERE d."equipmentId" = e.id)
  AND NOT EXISTS (SELECT 1 FROM "EquipmentBlessingDropRate" b WHERE b."equipmentId" = e.id);
