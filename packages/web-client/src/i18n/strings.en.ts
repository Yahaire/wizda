import { EQUIPMENT_CATEGORIES, EQUIPMENT_TYPES } from '@shared/domain/equipment';
import { EquipmentRankKind } from '@shared/domain/rank';

import type { EquipmentCategoryCode, EquipmentTypeKind } from '@shared/domain/equipment';
import type { UiStrings } from './strings';

/**
 * English is the identity mapping — built from the shared catalog rather than
 * re-typed, so it can never drift from `@shared/domain/equipment`.
 */
const CATEGORY_NAME_EN = Object.fromEntries(
  EQUIPMENT_CATEGORIES.map((category) => [category.code, category.name]),
) as Record<EquipmentCategoryCode, string>;

const EQUIPMENT_TYPE_NAME_EN = Object.fromEntries(
  EQUIPMENT_TYPES.map((type) => [type.kind, type.name]),
) as Record<EquipmentTypeKind, string>;

/** The sitewide UI-chrome catalog, in English. See `strings.ts` before editing. */
export const uiStringsEn = {
  meta: {
    home: {
      title: (appName: string) => `${appName} — Junk Oracle for Wizardry Variants Daphne`,
      description: [
        'Work out exactly how much junk you need to grind to get the item you want',
        'in Wizardry Variants Daphne. Free, no account, official drop rates.',
      ].join(' '),
    },
    junks: {
      title: (appName: string) => `Junk list — ${appName}`,
      description: [
        'Every junk in Wizardry Variants Daphne with its drop rates, the equipment it can yield.',
      ].join(' '),
    },
    equipment: {
      title: (appName: string) => `Equipment list — ${appName}`,
      description: [
        'Every weapon and armour piece in Wizardry Variants Daphne — rank, category, and which junk can drop it.',
      ].join(' '),
    },
    about: {
      title: (appName: string) => `About — ${appName}`,
      description: [
        'What Wizda is, how the junk-guarantee math works, where the drop-rate data comes from, and our data & privacy approach.',
      ].join(' '),
    },
  },
  nav: {
    toggleNavigationAriaLabel: 'Toggle navigation',
    junkLabel: 'Junk',
    equipmentLabel: 'Equipment',
    listsSectionLabel: 'Lists',
    aboutLabel: 'About',
    supportButtonLabel: 'Support the project',
    supportCaption: 'Fuels the next update ✨',
    languageToggleAriaLabel: 'Choose site language',
  },
  common: {
    clear: 'Reset',
    done: 'OK',
    backAriaLabel: 'Back',
    whatIsAriaLabel: (label) => `What is ${label}?`,
    clearAriaLabel: (label) => `Clear ${label}`,
    moreCount: (n) => `+${n} more`,
    sortByAriaLabel: (label) => `Sort by ${label.toLowerCase()}`,
    rowsShown: (n) => `${n} shown`,
    defaultSearchPlaceholder: 'Filter by name',
    defaultEmptyMessage: 'Nothing matches.',
    justNow: 'just now',
    any: 'Any',
    andUp: '+',
    joinList: (items, conjunction) => {
      if (items.length <= 1) {
        return items[0] ?? '';
      }
      if (items.length === 2) {
        return `${items[0]} ${conjunction} ${items[1]}`;
      }
      return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
    },
  },
  oracle: {
    equipmentLabel: 'Equipment',
    categoryLabel: 'Category',
    rankLabel: 'Rank',
    qualityLabel: 'Quality',
    gradeLabel: 'Grade',
    blessingsLabel: 'Blessings',
    certaintyLabel: 'Certainty',
    calculateButton: 'Calculate',
    subjectNoun: 'equipment',
    subjectAny: (noun) => `Any ${noun}`,
    subjectRankedInline: (ranks, noun) => `Any ${ranks} ${noun}`,
    subjectRankedTrailing: (noun, ranks) => `Any ${noun} (${ranks})`,
    resultsCount: (total) => `${total} ${total === 1 ? 'junk' : 'junks'} can get it`,
    columnJunk: 'Junk',
    columnPercentPerJunk: '%/junk',
    columnNumRequired: '# req.',
    showMoreButton: 'Show more',
    filterByNamePlaceholder: 'Filter by name',
    backToStartTooltip: 'Back to the start',
    blessingOddsTooltip: 'Blessing odds rest on one assumption — tap to see it',
    blessingOddsAriaLabel: 'The assumption behind these blessing odds',
    estimateModalTitle: 'About the blessing odds',
    calculationDocLinkLabel: 'The calculation doc',
    estimateFooterSuffix: 'spells out every step, and corrections are welcome.',
    conflictModalTitle: 'Hold on!',
    undoButton: 'Undo',
    cleanUpButton: 'Clean up',
    anyCategoryPlaceholder: 'Any category',
    addMoreCategoriesPlaceholder: 'Add more categories…',
    noMatchingCategory: 'No matching category',
    categoryGreyedHint: "Greyed out: no gear you've picked is that kind.",
    anyRankPlaceholder: 'Any rank',
    addMoreRanksPlaceholder: 'Add more ranks…',
    noMatchingRank: 'No matching rank',
    rankGreyedHint: "Greyed out: no gear you've picked comes in that rank.",
    searchEquipmentPlaceholder: 'Search equipment',
    addMoreGearPlaceholder: 'Add more gear…',
    noGearByName: 'No gear by that name',
    equipmentGreyedHint: "Greyed out: doesn't fit your category or rank picks.",
    unknownRankGroup: 'Unknown rank',
    slotsAny: 'Any amount of blessings',
    slotsAtLeastOne: 'At least 1 blessing',
    slotsFour: '4 blessings',
    slotsAtLeast: (n) => `At least ${n} blessings`,
    gradeSliderAriaLabel: 'Lowest acceptable grade',
    qualitySliderAriaLabel: 'Lowest acceptable quality',
    blessingsChooseButton: 'Choose blessings',
    blessingsCountButton: (n) => `Blessings (${n})`,
    blessingsModalTitle: 'Required blessings',
    blessingsDoneButton: 'OK',
    blessingsCapNote: (max) => `That's the most a single piece can hold (${max}).`,
    blessingsGreyedNote: "Greyed out: no gear your other filters allow could carry that one.",
    qualityListTooltip: 'Any of these quality levels',
    mustCarryAllTooltip: 'Must carry all of these',
    gradeTooltipLabel: (gradeNames) => `Grade: ${gradeNames}`,
    narrowedNote: 'Narrowed to the pieces this junk actually drops.',
    junkDetailsTitle: 'Junk details',
    multiPoolNote: [
      'Rates shown are for the latest version of this junk.',
      "If you haven't completed the progression that unlocks this area's newer pool,",
      'or you still have junks left from the previous version,',
      'your actual drops may differ.',
    ].join(' '),
    curveLoadError: (junkNeeded) => (
      `Couldn't chart nearby certainties — but you'll still need about ${junkNeeded} of these.`
    ),
    chancePerJunk: 'Chance per junk',
    seeFullDetailsButton: 'See full junk details',
  },
  lists: {
    junkTitle: 'Junk',
    equipmentTitle: 'Equipment',
    columnEquipment: 'Equipment',
    columnCategory: 'Category',
    columnRank: 'Rank',
    columnMaxQuality: 'Max ★',
    columnMaxGrade: 'Max grade',
    columnDrops: 'Drops',
    columnSources: 'Sources',
    columnNotes: 'Notes',
    uncategorisedLabel: 'Not known yet',
    multiplePoolsLabel: 'Multiple pools',
    junkLoadError: "Couldn't load the junk list — try refreshing.",
    equipmentLoadError: "Couldn't load the equipment list — try refreshing.",
    junkSearchPlaceholder: 'Filter junk by name',
    junkEmptyMessage: 'No junk by that name.',
    equipmentSearchPlaceholder: 'Filter gear by name',
    equipmentEmptyMessage: 'No gear matches those filters.',
    allRanksOption: 'All ranks',
    filterByRankAriaLabel: 'Filter by rank',
  },
  detail: {
    equipmentDetailsTitle: 'Equipment details',
    junkDetailsTitle: 'Junk details',
    junkNeededByCertainty: 'Junk needed by certainty',
    nameHeader: 'Name',
    qualityHeader: 'Quality',
    gradeHeader: 'Grade',
    rankLabel: 'Rank',
    maxLabel: 'Max',
    junkSourcesLabel: 'Junk sources',
    dropsFromNJunk: (n) => `Drops from ${n} junk${n === 1 ? '' : 's'}`,
    noJunkDrops: "No junk drops this one — so there's nothing for me to count here yet.",
    atBestDrops: 'At best it drops',
    dropsNPieces: (n) => `Drops ${n} piece${n === 1 ? '' : 's'} of gear`,
    noDroppableGear: 'No droppable gear on record.',
  },
  about: {
    title: (appName) => `About ${appName}`,
    introBody: (appName, oracleName) => [
      `${appName} tells you how much junk you need to grind to guarantee a specific item`,
      'in Wizardry Variants Daphne — so the fiddly drop-rate reversing gets done once, not',
      `every run. Use the ${oracleName} to pick what you're after, and browse the Junk and`,
      "Equipment lists for a tidier, searchable view of the game's data.",
    ].join(' '),
    guaranteeHeading: 'How the "guarantee" works',
    guaranteeBody: (oracleName) => [
      'A drop is never truly 100% certain, so instead of promising the impossible, the',
      `${oracleName} answers "how much junk to reach the confidence you asked for". Crank`,
      'it as high as you like — but even at the top, RNG still has the final say.',
    ].join(' '),
    twoThingsHeading: 'Two things to keep in mind',
    blessingOddsLead: 'Blessing odds rest on one assumption.',
    blessingOddsRest: [
      "The devs publish each slot's odds, but never say what the game does when a slot",
      'rolls a blessing the piece already has. We assume it rerolls that slot. If it starts',
      'the whole piece over instead, results shift by well under 1% for most gear — about',
      'a tenth at the extremes.',
    ].join(' '),
    multiplePoolsLead: 'Some junk has multiple versions.',
    multiplePoolsRest: [
      "A few junks changed over time; we store the newest. If you haven't unlocked an",
      "area's newer pool, your real drops may differ — those are marked with a note.",
    ].join(' '),
    contributeHeading: 'Contribute',
    contributeIntro: (appName, oracleName) => [
      `${appName} is open source, and none of the maths is hidden. Nearly every number the`,
      `${oracleName} prints comes out of these two lines:`,
    ].join(' '),
    formulaExplanation: [
      'The first is how much junk reaches certainty c when a single junk has chance P. The',
      'second is how a piece fills its blessing slots — one at a time, in order, never',
      'repeating, each slot re-weighted over whatever is left.',
    ].join(' '),
    docsReferenceLabel: 'Read more:',
    calculationDocLinkLabel: 'Calculations',
    domainDocLinkLabel: 'Wiz Daphne domain',
    askForHelpBody: [
      "If we've got something wrong, please tell us — especially if you play and know a",
      "mechanic we've modelled badly. You know things we don't.",
    ].join(' '),
    issueLinkLabel: 'Open an issue or pull request',
    githubButton: (appName) => `${appName} on GitHub`,
    dataPrivacyHeading: 'Data & privacy',
    dataPrivacyPrefix: 'Drop-rate data is compiled from',
    officialListsLinkLabel: 'the official lists',
    dataPrivacyMiddle: 'provided by the game devs. Equipment details come from the',
    fasterthoughtsLinkLabel: 'Fasterthoughts guide',
    dataPrivacySuffix: [
      '— special thanks to NRJank and the rest of the Fasterthoughts guys for compiling',
      'and maintaining equipment lists.',
    ].join(' '),
    privacyBody: [
      "We collect only minimal, anonymous usage stats to see what's useful — no accounts,",
      'and we never sell your data to anyone. Nothing links your visits together and no',
      'tracking cookie is ever set. The only thing we store on your device is your choice',
      'of language, and only if you pick one — that is why you won\'t find a "cookie',
      'consent" popup here: there\'s nothing for one to ask permission for.',
    ].join(' '),
    analyticsLinkLabel: 'More information on analytics.',
    supportHeading: 'Support the project',
    supportBody: (appName) => [
      `${appName} is free. It's made by one person — me, a Mexican software engineer living in Japan. Keeping the app up costs about $25 a year so if 9 people gave $3 (About 1 coffee), the app is covered for a whole year.`,

      "Any tip helps me continue developing the app after my kids go to sleep, but you'd rather just use the site, that's completely fine. It stays free either way.",
    ].join('\n\n'),
    supportButtonLabel: 'Support the project',
    creditsHeading: 'Credits',
    creditsBody: [
      'Equipment icons by Lorc, Delapouite and contributors, from game-icons.net, used',
      'under CC BY 3.0. Interface icons from Tabler Icons (MIT).',
    ].join(' '),
    disclaimer: [
      "is an unofficial, fan-made tool and isn't affiliated with or endorsed by the makers",
      'of Wizardry Variants Daphne.',
    ].join(' '),
  },
  notices: {
    equipmentLocalizationCaveat: [
      'Only equipment that drops from junk has a translated name — everything else stays',
      'in English.',
    ].join(' '),
  },
  maintenance: {
    subtitle: 'A Wizardry Variants Daphne Assistant',
  },
  dataFreshness: {
    tooltipLabel: 'How fresh is this data?',
    ariaLabel: 'Data freshness — where this data comes from',
  },
  vocab: {
    gradeName: {
      1: 'White',
      2: 'Green',
      3: 'Blue',
      4: 'Purple',
      5: 'Red',
    },
    rankName: {
      [EquipmentRankKind.WORN]: 'Worn',
      [EquipmentRankKind.BRONZE]: 'Bronze',
      [EquipmentRankKind.IRON]: 'Iron',
      [EquipmentRankKind.STEEL]: 'Steel',
      [EquipmentRankKind.EBONSTEEL]: 'Ebonsteel',
      [EquipmentRankKind.SILVER]: 'Silver',
    },
    blessingLabel: (statKind, isPercent) => (isPercent ? `${statKind}%` : statKind),
    categoryName: CATEGORY_NAME_EN,
    equipmentTypeName: EQUIPMENT_TYPE_NAME_EN,
  },
} satisfies UiStrings;
