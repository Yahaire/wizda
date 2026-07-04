/**
 * Stats & blessings — static reference data.
 *
 * Single source of truth for the values seeded into the DB's `Stat` and
 * `Blessing` tables (see packages/backend-api/prisma/schema.prisma). The
 * Prisma `StatKind` enum mirrors {@link StatKind} here; the seed reads
 * {@link STATS} and {@link BLESSINGS} so descriptions and the catalog never
 * drift between the DB and the app.
 */

/** The ten raw stats a piece of gear can carry. */
export enum StatKind {
  ATK = 'ATK',
  MAG = 'MAG',
  DIV = 'DIV',
  ACC = 'ACC',
  EVA = 'EVA',
  RES = 'RES',
  DEF = 'DEF',
  MDEF = 'MDEF',
  ASPD = 'ASPD',
  SUR = 'SUR',
}

export interface StatInfo {
  kind: StatKind,
  /** Display name. NOTE: tentative — confirm against in-game wording. */
  name: string,
  description: string,
  /**
   * Whether this stat also rolls as a percentage blessing. All stats have a
   * flat and a % variant except SUR, which is flat-only.
   */
  hasPercentVariant: boolean,
}

/** The raw stats, in display order. Seeds the `Stat` table. */
export const STATS: readonly StatInfo[] = [
  {
    kind: StatKind.ATK,
    name: 'Attack power',
    description: 'Dictates how much damage physical attacks do',
    hasPercentVariant: true,
  },
  {
    kind: StatKind.MAG,
    name: 'Magic power',
    description:
      'Dictates how much damage magical attacks do as well as probability of magical debuffs to land',
    hasPercentVariant: true,
  },
  {
    kind: StatKind.DIV,
    name: 'Divine power',
    description:
      'Dictates how much damage holy attacks do as well as how much health is restored with healing skills',
    hasPercentVariant: true,
  },
  {
    kind: StatKind.ACC,
    name: 'Accuracy',
    description: 'Higher accuracy makes it easier to land physical attacks on enemies',
    hasPercentVariant: true,
  },
  {
    kind: StatKind.EVA,
    name: 'Evasion',
    description: 'Higher evasion makes it easier to completely evade physical attacks from enemies',
    hasPercentVariant: true,
  },
  {
    kind: StatKind.RES,
    name: 'Resistance',
    description:
      'Higher resistance means your character can resist status effects from enemies and traps',
    hasPercentVariant: true,
  },
  {
    kind: StatKind.DEF,
    name: 'Defense',
    description: 'Dictates damage reduction from received physical attacks',
    hasPercentVariant: true,
  },
  {
    kind: StatKind.MDEF,
    name: 'Magic defense',
    description: 'Dictates damage reduction from received magical and holy attacks',
    hasPercentVariant: true,
  },
  {
    kind: StatKind.ASPD,
    name: 'Action speed',
    description: 'Determines turn order in fights',
    hasPercentVariant: true,
  },
  {
    kind: StatKind.SUR,
    name: 'Surety',
    description:
      '1 SUR = 1% chance that your attack will "surety hit" (usually known as "critical hit" in other games)',
    hasPercentVariant: false,
  },
];

export interface BlessingInfo {
  /** Readable code, e.g. "ATK", "ATK_PER", "SUR". */
  code: string,
  statKind: StatKind,
  isPercent: boolean,
}

/** Build the catalog code for a (stat, variant) pair. */
export function getBlessingCode(statKind: StatKind, isPercent: boolean): string {
  return isPercent ? `${statKind}_PER` : statKind;
}

/**
 * The concrete stats that can roll as a blessing — a flat and a % variant per
 * stat, minus SUR% (SUR is flat-only). Seeds the `Blessing` table.
 */
export const BLESSINGS: readonly BlessingInfo[] = STATS.flatMap((stat) => {
  const flat: BlessingInfo = {
    code: getBlessingCode(stat.kind, false),
    statKind: stat.kind,
    isPercent: false,
  };

  if (!stat.hasPercentVariant) {
    return [flat];
  }

  return [
    flat,
    {
      code: getBlessingCode(stat.kind, true),
      statKind: stat.kind,
      isPercent: true,
    },
  ];
});
