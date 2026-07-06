/** Upserts rows identified by `name` in bulk: one findMany, then one createMany for whatever's missing. */
export async function upsertNamesGetIds(
  names: string[],
  findExisting: (names: string[]) => Promise<{ id: string; name: string }[]>,
  createMissing: (names: string[]) => Promise<unknown>,
): Promise<Map<string, string>> {
  const existing = await findExisting(names);
  const idByName = new Map(existing.map((row) => [row.name, row.id]));

  const missingNames = names.filter((name) => !idByName.has(name));
  if (missingNames.length > 0) {
    await createMissing(missingNames);
    const created = await findExisting(missingNames);
    for (const row of created) {
      idByName.set(row.name, row.id);
    }
  }

  return idByName;
}
