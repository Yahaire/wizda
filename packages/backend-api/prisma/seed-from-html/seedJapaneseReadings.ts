// kuroshiro pulls kuromoji's ~41 MB IPADIC dictionary. It is a *seed-only*
// dependency: never import it from `src/`, or every API process pays the
// dictionary load for a column it only ever reads. See kuroshiro.d.ts.
import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';
import path from 'path';

import { Prisma, PrismaClient } from '@local-prisma/generated/client';

/** Any CJK ideograph — what "kuroshiro couldn't read this" looks like in its output. */
const KANJI_PATTERN = /[一-鿿]/;

/*
 * Overrides come in two flavours, and which table an entry belongs in is a
 * question of *when* it can be applied, not how long the key is:
 *
 *   name ──▶ KANJI_RUN_READINGS ──▶ kuroshiro ──▶ RESIDUAL_KANJI_READINGS ──▶ reading
 *
 * Every reading below has been confirmed against the item's English name
 * (2026-07-23); they are no longer guesses.
 */

/**
 * Readings for kanji runs kuromoji segments *wrongly*, substituted into the name
 * **before** conversion.
 *
 * Needed when the correct reading spans more than one character, because a
 * post-pass can never see such a run intact: kuroshiro converts the characters it
 * does recognise, so by the time we get the output only the unreadable ones
 * survive, stranded among kana. `鬼啼島` comes back as `おに啼とう` — 島 has already
 * become とう, so there is no `啼島` left to match on.
 *
 * Substituting early is not free, so keep this table minimal: splicing kana into
 * the name changes how kuromoji tokenises its *neighbours*. Measured — replacing
 * `棍` here turns `水零の戦棍` from `みずれいのせん棍` into `みずれいのおののこん`,
 * misreading 戦 as おの. Anything that a per-character patch can fix belongs in
 * {@link RESIDUAL_KANJI_READINGS} instead, which runs after conversion and so
 * cannot disturb anything.
 */
const KANJI_RUN_READINGS: Readonly<Record<string, string>> = {
  // 鬼啼島 "Island of the Wailing Oni" -> おになきじま. Verified that 啼 never
  // appears outside this run (9 names, all 鬼啼島), and that 鬼 still reads おに
  // with なきじま spliced in.
  啼島: 'なきじま',
};

/** Longest run first, so a longer key always wins over a shorter one inside it. */
const KANJI_RUN_KEYS: readonly string[] = Object.keys(KANJI_RUN_READINGS)
  .sort((left, right) => right.length - left.length);

/**
 * Readings for single kanji kuroshiro leaves untouched, applied
 * character-by-character **after** conversion.
 *
 * kuromoji is trained on ordinary Japanese, and this catalogue is full of coined
 * fantasy compounds, so a residue is expected — Elastic's own docs note their
 * `kuromoji_readingform` mis-splits kana and recommend a supplementary filter,
 * so patching the tail is the normal shape of this problem, not a workaround.
 * Measured over all 1,195 scraped names, the residue is a handful of characters
 * and `妖` alone is 96% of it (179 of 211 failures): `妖なる` ("Fey") is an
 * archaic adjectival form the analyzer can't parse.
 *
 * Safe by construction — running after conversion, an entry here can only change
 * the character it replaces. Prefer it over {@link KANJI_RUN_READINGS} whenever
 * a per-character reading is correct.
 */
const RESIDUAL_KANJI_READINGS: Readonly<Record<string, string>> = {
  // 妖なる ("Fey") -> あやなる, after 妖しい = あやしい.
  妖: 'あや',
  // 地裂の剣 -> ちれつのけん.
  裂: 'れつ',
  // 戦棍 -> せんこん, after 棍棒 = こんぼう. Must stay a post-pass — see the
  // tokenisation warning on KANJI_RUN_READINGS.
  棍: 'こん',
  // 三ツ窟 -> さんツくつ, after 魔窟 = まくつ.
  窟: 'くつ',
  // 柑刺し -> かんざし; the name puns on 簪 (hairpin), so かん is near-certain.
  柑: 'かん',
  // 鋏杖 -> はさみつえ; 杖 takes its kun reading here, so 鋏 follows suit.
  鋏: 'はさみ',
};

/** One row's English key and the Japanese name we need a reading for. */
interface JapaneseNameRow {
  name: string;
  nameJa: string;
}

/**
 * Narrows rows to those that actually carry a Japanese name. The `nameJa: { not: null }`
 * filter can't do this on its own — Prisma types the column from the schema, not
 * from the `where`, so it still reads `string | null` here.
 */
function withJapaneseName(rows: readonly { name: string, nameJa: string | null }[]): JapaneseNameRow[] {
  return rows.flatMap((row) => (row.nameJa === null ? [] : [{ name: row.name, nameJa: row.nameJa }]));
}

interface ReadingResult {
  /** Reading keyed by English `name`, ready for {@link applyReadings}. */
  readingsByEnglishName: Map<string, string>;
  /** Names still holding kanji after the override pass — see {@link RESIDUAL_KANJI_READINGS}. */
  unreadable: string[];
}

/**
 * Bulk-writes readings by English `name`, mirroring the `UPDATE … FROM (VALUES …)`
 * pattern `seedLocalizedNames.ts` uses. `table` is always one of the two internal
 * literals below — never request input — so interpolating it as a raw identifier
 * is safe.
 */
async function applyReadings(
  tx: Prisma.TransactionClient,
  table: 'Equipment' | 'Junk',
  readingsByEnglishName: ReadonlyMap<string, string>,
): Promise<void> {
  if (readingsByEnglishName.size === 0) {
    return;
  }

  const values = [...readingsByEnglishName].map(([englishName, reading]) => Prisma.sql`(
    ${englishName}, ${reading}
  )`);

  await tx.$executeRaw`
    UPDATE ${Prisma.raw(`"${table}"`)} AS t
    SET "nameJaReading" = v.reading
    FROM (VALUES ${Prisma.join(values)}) AS v(englishName, reading)
    WHERE t."name" = v.englishName
  `;
}

/** Swaps in {@link KANJI_RUN_READINGS} before the analyzer ever sees the name. */
function applyRunReadings(name: string): string {
  return KANJI_RUN_KEYS.reduce(
    (patched, run) => patched.split(run).join(KANJI_RUN_READINGS[run]!),
    name,
  );
}

/** Replaces any kanji kuroshiro left behind with its {@link RESIDUAL_KANJI_READINGS} entry. */
function applyResidualReadings(reading: string): string {
  return [...reading]
    .map((char) => RESIDUAL_KANJI_READINGS[char] ?? char)
    .join('');
}

async function convertAll(
  kuroshiro: Kuroshiro,
  rows: readonly JapaneseNameRow[],
): Promise<ReadingResult> {
  const readingsByEnglishName = new Map<string, string>();
  const unreadable: string[] = [];

  for (const row of rows) {
    const converted = await kuroshiro.convert(applyRunReadings(row.nameJa), { to: 'hiragana' });
    const reading = applyResidualReadings(converted);
    readingsByEnglishName.set(row.name, reading);
    if (KANJI_PATTERN.test(reading)) {
      unreadable.push(`${row.nameJa} -> ${reading}`);
    }
  }

  return { readingsByEnglishName, unreadable };
}

/**
 * Fills `Equipment`/`Junk.nameJaReading` — the hiragana reading of each Japanese
 * name — so the frontend's search can bridge scripts. Japanese writes one name
 * in kanji, hiragana and katakana at once, and no amount of string normalization
 * gets a player typing `よる` to `夜`: that needs a dictionary, so we run one here
 * and store the answer. Same idea as an Elasticsearch `kuromoji_readingform`
 * field or the フリガナ column on a Japanese web form.
 *
 * Stored **un-normalized** (katakana left as katakana, casing and punctuation
 * untouched) — folding it into a search key is the client's `normalize()`, which
 * means tuning that heuristic never costs a reseed.
 *
 * Reads `nameJa` back out of the DB rather than taking it as an argument, so it
 * doesn't care how those names got there and can be re-run on its own. Runs
 * after `seedLocalizedNames`, and no-ops when no row has a Japanese name yet
 * (e.g. a first seed where the `ja` scrape failed to align) — English is always
 * the fallback, so a missing reading costs search reach, never correctness.
 */
export async function seedJapaneseReadings(prisma: PrismaClient): Promise<void> {
  const [equipment, junks] = await Promise.all([
    prisma.equipment.findMany({
      where: { nameJa: { not: null } },
      select: { name: true, nameJa: true },
    }),
    prisma.junk.findMany({
      where: { nameJa: { not: null } },
      select: { name: true, nameJa: true },
    }),
  ]);

  const equipmentRows = withJapaneseName(equipment);
  const junkRows = withJapaneseName(junks);

  if (equipmentRows.length === 0 && junkRows.length === 0) {
    console.log('[seed] [ja] no Japanese names stored — skipping the reading pass.');
    return;
  }

  const startedAt = Date.now();
  const kuroshiro = new Kuroshiro();
  // Resolve the dictionary off kuromoji's own package root rather than a literal
  // node_modules path: npm workspaces may hoist it to the monorepo root.
  const dictPath = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');
  await kuroshiro.init(new KuromojiAnalyzer({ dictPath }));

  const equipmentReadings = await convertAll(kuroshiro, equipmentRows);
  const junkReadings = await convertAll(kuroshiro, junkRows);

  await prisma.$transaction(async (tx) => {
    await applyReadings(tx, 'Equipment', equipmentReadings.readingsByEnglishName);
    await applyReadings(tx, 'Junk', junkReadings.readingsByEnglishName);
  }, { timeout: 60_000 });

  const total = equipmentRows.length + junkRows.length;
  console.log(`[seed] [ja] wrote ${equipmentReadings.readingsByEnglishName.size} equipment `
    + `and ${junkReadings.readingsByEnglishName.size} junk reading(s) in ${Date.now() - startedAt}ms.`);

  // Loud on purpose. This is what keeps RESIDUAL_KANJI_READINGS honest: a future
  // scrape introducing an unknown character surfaces here at seed time instead of
  // quietly costing those items their kana search path months later.
  const unreadable = [...equipmentReadings.unreadable, ...junkReadings.unreadable];
  if (unreadable.length > 0) {
    console.warn(`[seed] [ja] WARNING ${unreadable.length}/${total} name(s) still contain kanji after `
      + 'conversion — add the missing character(s) to RESIDUAL_KANJI_READINGS in '
      + 'seedJapaneseReadings.ts (these items stay searchable by kanji, just not by kana):');
    for (const entry of unreadable) {
      console.warn(`[seed] [ja]   - ${entry}`);
    }
  }
}
