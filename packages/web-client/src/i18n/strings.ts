import type { EquipmentCategoryCode, EquipmentTypeKind } from '@shared/domain/equipment';
import type { EquipmentRankKind } from '@shared/domain/rank';
import type { StatKind } from '@shared/domain/stats';

/**
 * Sitewide UI-chrome text — every label, placeholder, button, and static
 * message the app shows, outside of Wizda's own personality-laden lines (see
 * `src/mascot/voice.ts`, a parallel, separately-maintained catalog for her).
 * Same shape as her catalog and the same rule applies: static leaves are
 * strings, and anything interpolated, pluralized, or word-order-sensitive is a
 * function leaf — the catalog owns the sentence, the caller owns the values.
 *
 * A translation is a parallel object of this exact shape (`strings.<lang>.ts`),
 * `satisfies UiStrings` so a missing or mistyped entry is a compile error. See
 * `docs/glossary.md` for the in-game terms (`vocab` below) so translators stay
 * consistent across this file, `voice.<lang>.ts`, and the glossary itself.
 */
export interface UiStrings {
  /**
   * The `<title>` and `<meta name="description">` for each route, per language —
   * what search engines actually show. This is where multilingual SEO lives:
   * the URL slugs stay English on purpose (see `docs/i18n.md`), so these strings
   * carry the whole weight of a locale's search presence.
   *
   * Titles take the app name rather than hardcoding it, so each language owns
   * its own word order and separator. **A new route needs an entry here** — the
   * step most easily forgotten; `docs/i18n.md` carries the checklist.
   */
  readonly meta: {
    readonly home: {
      readonly title: (appName: string) => string,
      readonly description: string,
    },
    readonly junks: {
      readonly title: (appName: string) => string,
      readonly description: string,
    },
    readonly equipment: {
      readonly title: (appName: string) => string,
      readonly description: string,
    },
    readonly about: {
      readonly title: (appName: string) => string,
      readonly description: string,
    },
  },
  readonly nav: {
    readonly toggleNavigationAriaLabel: string,
    readonly junkLabel: string,
    readonly equipmentLabel: string,
    readonly listsSectionLabel: string,
    readonly aboutLabel: string,
    readonly supportButtonLabel: string,
    readonly supportCaption: string,
    readonly languageToggleAriaLabel: string,
  },
  readonly common: {
    readonly clear: string,
    readonly done: string,
    readonly backAriaLabel: string,
    readonly whatIsAriaLabel: (label: string) => string,
    readonly clearAriaLabel: (label: string) => string,
    readonly moreCount: (n: number) => string,
    readonly sortByAriaLabel: (label: string) => string,
    readonly rowsShown: (n: number) => string,
    readonly defaultSearchPlaceholder: string,
    readonly defaultEmptyMessage: string,
    /**
     * Tooltip + `aria-label` for the share button (see `ShareButton`). Names the
     * intent, not the mechanism — the button opens the OS share sheet where one
     * exists and falls back to copying the link where it doesn't.
     */
    readonly shareLabel: string,
    /** The "under a minute ago" relative-time form (see `utils/relativeTime`). */
    readonly justNow: string,
    /** The level sliders' floor — "this and everything above it" starting from nothing. */
    readonly any: string,
    /** "…and everything above." Shown at the top of a level slider. */
    readonly andUp: string,
    /**
     * Join a list the way the language speaks it — the locale owns both the
     * separator and any final conjunction. `conjunction` is the sense ("and" vs
     * "or"); a language without that distinction may ignore it.
     */
    readonly joinList: (items: string[], conjunction: 'and' | 'or') => string,
  },
  readonly oracle: {
    readonly equipmentLabel: string,
    readonly categoryLabel: string,
    readonly rankLabel: string,
    readonly qualityLabel: string,
    readonly gradeLabel: string,
    readonly blessingsLabel: string,
    readonly certaintyLabel: string,
    readonly calculateButton: string,
    /** Fallback noun when the query names no category — "equipment". */
    readonly subjectNoun: string,
    /** "Any {noun}" — no rank constraint. */
    readonly subjectAny: (noun: string) => string,
    /** "Any {ranks} {noun}" — rank(s) as an adjective on the noun (`ranks` pre-joined). */
    readonly subjectRankedInline: (ranks: string, noun: string) => string,
    /** "Any {noun} ({ranks})" — rank(s) trailing, when an inline adjective would misread. */
    readonly subjectRankedTrailing: (noun: string, ranks: string) => string,
    /** "{n} junks can get it" — word order and pluralization live here. */
    readonly resultsCount: (total: number) => string,
    readonly columnJunk: string,
    readonly columnPercentPerJunk: string,
    readonly columnNumRequired: string,
    readonly showMoreButton: string,
    readonly filterByNamePlaceholder: string,
    readonly backToStartTooltip: string,
    readonly blessingOddsTooltip: string,
    readonly blessingOddsAriaLabel: string,
    readonly estimateModalTitle: string,
    readonly calculationDocLinkLabel: string,
    readonly estimateFooterSuffix: string,
    readonly conflictModalTitle: string,
    readonly undoButton: string,
    readonly cleanUpButton: string,
    readonly anyCategoryPlaceholder: string,
    readonly addMoreCategoriesPlaceholder: string,
    readonly noMatchingCategory: string,
    readonly categoryGreyedHint: string,
    readonly anyRankPlaceholder: string,
    readonly addMoreRanksPlaceholder: string,
    readonly noMatchingRank: string,
    readonly rankGreyedHint: string,
    readonly searchEquipmentPlaceholder: string,
    readonly addMoreGearPlaceholder: string,
    readonly noGearByName: string,
    readonly equipmentGreyedHint: string,
    readonly unknownRankGroup: string,
    readonly slotsAny: string,
    readonly slotsAtLeastOne: string,
    readonly slotsFour: string,
    readonly slotsAtLeast: (n: number) => string,
    readonly gradeSliderAriaLabel: string,
    readonly qualitySliderAriaLabel: string,
    readonly blessingsChooseButton: string,
    readonly blessingsCountButton: (n: number) => string,
    readonly blessingsModalTitle: string,
    readonly blessingsDoneButton: string,
    readonly blessingsCapNote: (max: number) => string,
    readonly blessingsGreyedNote: string,
    readonly qualityListTooltip: string,
    readonly mustCarryAllTooltip: string,
    readonly gradeTooltipLabel: (gradeNames: string) => string,
    readonly narrowedNote: string,
    readonly junkDetailsTitle: string,
    readonly multiPoolNote: string,
    readonly curveLoadError: (junkNeeded: string) => string,
    readonly chancePerJunk: string,
    readonly seeFullDetailsButton: string,
  },
  readonly lists: {
    readonly junkTitle: string,
    readonly equipmentTitle: string,
    readonly columnEquipment: string,
    readonly columnCategory: string,
    readonly columnRank: string,
    readonly columnMaxQuality: string,
    readonly columnMaxGrade: string,
    readonly columnDrops: string,
    readonly columnSources: string,
    readonly columnNotes: string,
    /**
     * Category/rank cell for a piece we hold drop rates for but couldn't classify
     * — usually gear the game added before the taxonomy source caught up. Says
     * "not known yet", never "has none": the guarantee math is unaffected.
     */
    readonly uncategorisedLabel: string,
    readonly multiplePoolsLabel: string,
    readonly junkLoadError: string,
    readonly equipmentLoadError: string,
    readonly junkSearchPlaceholder: string,
    readonly junkEmptyMessage: string,
    readonly equipmentSearchPlaceholder: string,
    readonly equipmentEmptyMessage: string,
    readonly allRanksOption: string,
    readonly filterByRankAriaLabel: string,
  },
  readonly detail: {
    readonly equipmentDetailsTitle: string,
    readonly junkDetailsTitle: string,
    readonly junkNeededByCertainty: string,
    readonly nameHeader: string,
    readonly qualityHeader: string,
    readonly gradeHeader: string,
    readonly rankLabel: string,
    readonly maxLabel: string,
    readonly junkSourcesLabel: string,
    readonly dropsFromNJunk: (n: number) => string,
    readonly noJunkDrops: string,
    readonly atBestDrops: string,
    readonly dropsNPieces: (n: number) => string,
    readonly noDroppableGear: string,
  },
  readonly about: {
    readonly title: (appName: string) => string,
    readonly introBody: (appName: string, oracleName: string) => string,
    readonly guaranteeHeading: string,
    readonly guaranteeBody: (oracleName: string) => string,
    readonly twoThingsHeading: string,
    readonly blessingOddsLead: string,
    readonly blessingOddsRest: string,
    readonly multiplePoolsLead: string,
    readonly multiplePoolsRest: string,
    readonly contributeHeading: string,
    readonly contributeIntro: (appName: string, oracleName: string) => string,
    readonly formulaExplanation: string,
    readonly docsReferenceLabel: string,
    readonly calculationDocLinkLabel: string,
    readonly domainDocLinkLabel: string,
    readonly askForHelpBody: string,
    readonly issueLinkLabel: string,
    readonly githubButton: (appName: string) => string,
    readonly dataPrivacyHeading: string,
    readonly dataPrivacyPrefix: string,
    readonly officialListsLinkLabel: string,
    readonly dataPrivacyMiddle: string,
    readonly fasterthoughtsLinkLabel: string,
    readonly dataPrivacySuffix: string,
    readonly privacyBody: string,
    readonly analyticsLinkLabel: string,
    readonly supportHeading: string,
    readonly supportBody: (appName: string) => string,
    readonly supportButtonLabel: string,
    readonly creditsHeading: string,
    readonly creditsBody: string,
    readonly disclaimer: string,
  },
  readonly notices: {
    /** Shown on the equipment list/detail when non-junk-dropping gear stays in English. */
    readonly equipmentLocalizationCaveat: string,
  },
  readonly maintenance: {
    readonly subtitle: string,
  },
  readonly dataFreshness: {
    readonly tooltipLabel: string,
    readonly ariaLabel: string,
  },
  /**
   * In-game terms whose English source lives in `@shared/domain/*` (grade,
   * rank). Keyed by the same stable identifiers those tables use, so a lookup
   * never depends on the English display string. See `docs/glossary.md`.
   */
  readonly vocab: {
    readonly gradeName: Record<1 | 2 | 3 | 4 | 5, string>,
    readonly rankName: Record<EquipmentRankKind, string>,
    /**
     * Short blessing chip/pill text, e.g. "ATK", "ATK%" in English. A function
     * leaf rather than a `Record` because the percent variant isn't guaranteed
     * to be a plain suffix in every language.
     */
    readonly blessingLabel: (statKind: StatKind, isPercent: boolean) => string,
    /** Equipment category display name, e.g. "Two-Handed Axe". */
    readonly categoryName: Record<EquipmentCategoryCode, string>,
    /** Equipment-type group header, e.g. "Weapons" — used above the category filter. */
    readonly equipmentTypeName: Record<EquipmentTypeKind, string>,
  },
}
