import { EquipmentTypeKind } from '@shared/domain/equipment';
import { EquipmentRankKind } from '@shared/domain/rank';
import { StatKind } from '@shared/domain/stats';

import {
    JA_BLESSINGS, JA_CATEGORY, JA_CERTAINTY, JA_EQUIPMENT, JA_GRADE, JA_QUALITY, JA_RANK
} from './glossary.ja';

import type { EquipmentCategoryCode } from '@shared/domain/equipment';
import type { UiStrings } from './strings';

/**
 * JA equipment category names, confirmed against the in-game category dropdown
 * screenshots (see `docs/glossary.md`).
 */
const JA_CATEGORY_NAME: Record<EquipmentCategoryCode, string> = {
  // Weapons
  DAGGER: '短剣',
  ONE_HANDED_SWORD: '片手剣',
  ONE_HANDED_AXE: '片手斧',
  ONE_HANDED_STAFF: '片手杖',
  ONE_HANDED_BLUNT_WEAPON: '片手鈍器',
  THROWING_NINJA_TOOL: '投擲忍具',
  NINJATO: '忍者刀',
  KATANA: '刀',
  TWO_HANDED_SWORD: '両手剣',
  TWO_HANDED_AXE: '両手斧',
  TWO_HANDED_STAFF: '両手杖',
  TWO_HANDED_BLUNT_WEAPON: '両手鈍器',
  TWO_HANDED_SPEAR: '両手槍',
  BOW: '弓',
  ODACHI: '大太刀',
  CESTI: 'セスタス',
  TOOLS: '工具',
  // Shields
  SMALL_SHIELD: '小盾',
  LIGHT_SHIELD: '軽盾',
  HEAVY_SHIELD: '重盾',
  // Helmets
  HAT: '帽子',
  LIGHT_HELMET: '軽兜',
  HEAVY_HELMET: '重兜',
  // Gloves
  GLOVES: '手袋',
  LIGHT_GAUNTLETS: '軽篭手',
  HEAVY_GAUNTLETS: '重篭手',
  // Chest armor
  CLOTHES: '衣服',
  LIGHT_ARMOR: '軽鎧',
  HEAVY_ARMOR: '重鎧',
  // Boots
  SHOES: '靴',
  LIGHT_ARMOR_BOOTS: '軽足鎧',
  HEAVY_ARMOR_BOOTS: '重足鎧',
  // Accessories
  ACCESSORIES: '装飾品',
};

/**
 * JA equipment-type group headers — `WEAPON`/`ACCESSORY` confirmed, the rest
 * best-effort. See `docs/glossary.md`'s "Equipment types" section for why.
 */
const JA_EQUIPMENT_TYPE_NAME: Record<EquipmentTypeKind, string> = {
  [EquipmentTypeKind.WEAPON]: '武器',
  [EquipmentTypeKind.SHIELD]: '盾',
  [EquipmentTypeKind.HELMET]: '頭防具',
  [EquipmentTypeKind.GLOVES]: '手防具',
  [EquipmentTypeKind.CHEST_ARMOR]: '胴防具',
  [EquipmentTypeKind.BOOTS]: '足防具',
  [EquipmentTypeKind.ACCESSORY]: '装飾品',
};

/** Short JA blessing base name per stat. See `docs/glossary.md`'s "Blessing 
 * stat names" section for why.
 **/
const JA_STAT_LABEL: Record<StatKind, string> = {
  [StatKind.ATK]: '攻撃力',
  [StatKind.MAG]: '魔力',
  [StatKind.DIV]: '神力',
  [StatKind.ACC]: '命中',
  [StatKind.EVA]: '回避',
  [StatKind.RES]: '抵抗',
  [StatKind.DEF]: '防御力',
  [StatKind.MDEF]: '魔術防御力',
  [StatKind.ASPD]: '行動速度',
  [StatKind.SUR]: '会心',
};

/**
 * The sitewide UI-chrome catalog, in Japanese. A parallel of `strings.en.ts` —
 * same shape, `satisfies UiStrings`. A first pass meant for a native/game-
 * literate editor to revise; see `docs/glossary.md` for the in-game terms.
 */
export const uiStringsJa = {
  meta: {
    home: {
      title: (appName: string) => `${appName} — 「ウィザードリィ ヴァリアンツ ダフネ」ガラクタ計算ツール`,
      description: [
        '「ウィザードリィ ヴァリアンツ ダフネ」で欲しい装備を確実に手に入れるために、',
        'ガラクタを何個集めればいいかを計算します。公式ドロップ率、無料、登録不要。',
      ].join(''),
    },
    junks: {
      title: (appName: string) => `ガラクタ一覧 — ${appName}`,
      description: [
        '「ウィザードリィ ヴァリアンツ ダフネ」の全ガラクタのドロップ率、入手できる装備、',
        '確定に必要な個数の一覧。',
      ].join(''),
    },
    equipment: {
      title: (appName: string) => `${JA_EQUIPMENT}一覧 — ${appName}`,
      description: [
        '「ウィザードリィ ヴァリアンツ ダフネ」の全武器・防具の一覧。',
        `${JA_RANK}、${JA_CATEGORY}、どのガラクタから出るかを確認できます。`,
      ].join(''),
    },
    about: {
      title: (appName: string) => `当サイトについて — ${appName}`,
      description: [
        'Wizdaの使い方、ガラクタ確定計算の仕組み、ドロップ率データの出典、',
        'データとプライバシーの方針について。',
      ].join(''),
    },
  },
  nav: {
    toggleNavigationAriaLabel: 'ナビゲーションバーの表示 / 非表示',
    junkLabel: 'ガラクタ',
    equipmentLabel: JA_EQUIPMENT,
    listsSectionLabel: 'リスト',
    aboutLabel: '当サイトについて',
    supportButtonLabel: 'ご支援のお願い',
    supportCaption: '運営の励みになります ✨',
    languageToggleAriaLabel: '言語変更',
  },
  common: {
    clear: 'リセット', // In-game term
    done: 'OK', // In-game term
    backAriaLabel: '戻る',
    whatIsAriaLabel: (label) => `「${label}」とは？`,
    clearAriaLabel: (label) => `${label}をクリア`,
    moreCount: (n) => `他${n}件`,
    sortByAriaLabel: (label) => `${label}で並べ替え`,
    rowsShown: (n) => `${n}件表示`,
    defaultSearchPlaceholder: '名前で絞り込み',
    defaultEmptyMessage: '一致するものがありません。',
    justNow: 'たった今',
    any: '指定なし',
    andUp: '+',
    // Japanese joins with the middle dot and draws no and/or distinction.
    joinList: (items) => items.filter((item) => item !== '').join('・'),
  },
  oracle: {
    equipmentLabel: JA_EQUIPMENT,
    categoryLabel: JA_CATEGORY,
    rankLabel: JA_RANK,
    qualityLabel: JA_QUALITY,
    gradeLabel: JA_GRADE,
    blessingsLabel: JA_BLESSINGS,
    certaintyLabel: JA_CERTAINTY,
    calculateButton: '計算',
    subjectNoun: JA_EQUIPMENT,
    subjectAny: (noun) => `${noun}（指定なし）`,
    subjectRankedInline: (ranks, noun) => `${ranks}の${noun}`,
    subjectRankedTrailing: (noun, ranks) => `${noun}（${ranks}）`,
    resultsCount: (total) => `${total}種類のガラクタで入手可能`,
    columnJunk: 'ガラクタ',
    columnPercentPerJunk: '％ / 個',
    columnNumRequired: '必要個数',
    showMoreButton: 'もっと見る',
    filterByNamePlaceholder: '名前で絞り込み',
    backToStartTooltip: 'トップに戻る',
    blessingOddsTooltip: `${JA_BLESSINGS}の出現率は前提条件により変わります。タップして確認する`,
    blessingOddsAriaLabel: `この${JA_BLESSINGS}の出現率の前提条件`,
    estimateModalTitle: `${JA_BLESSINGS}の出現率について`,
    calculationDocLinkLabel: '計算についての詳細（英語）',
    estimateFooterSuffix: 'にてすべての手順が記載されています。修正も受け付けています。',
    conflictModalTitle: 'ちょっと待って！',
    undoButton: 'やり直す',
    cleanUpButton: '削除する',
    anyCategoryPlaceholder: `${JA_CATEGORY}指定なし`,
    addMoreCategoriesPlaceholder: `${JA_CATEGORY}を追加する`,
    noMatchingCategory: `一致する${JA_CATEGORY}がありません`,
    categoryGreyedHint: `選択不可の場合：選択した${JA_EQUIPMENT}の該当${JA_CATEGORY}なし`,
    anyRankPlaceholder: `${JA_RANK}指定なし`,
    addMoreRanksPlaceholder: `${JA_RANK}を追加する`,
    noMatchingRank: `一致する${JA_RANK}がありません`,
    rankGreyedHint: `選択不可の場合：選択した${JA_EQUIPMENT}の該当${JA_RANK}なし`,
    searchEquipmentPlaceholder: `${JA_EQUIPMENT}を検索する`,
    addMoreGearPlaceholder: `${JA_EQUIPMENT}を追加する`,
    noGearByName: `該当する${JA_EQUIPMENT}がありません`,
    equipmentGreyedHint: `選択不可の場合：選択した${JA_CATEGORY}や${JA_RANK}に一致しません`,
    unknownRankGroup: `${JA_RANK}不明`,
    slotsAny: `${JA_BLESSINGS}　指定なし`,
    slotsAtLeastOne: `${JA_BLESSINGS}　1以上`,
    slotsFour: `${JA_BLESSINGS}　4`,
    slotsAtLeast: (n) => `${JA_BLESSINGS}　${n}以上`,
    gradeSliderAriaLabel: `${JA_GRADE}下限`,
    qualitySliderAriaLabel: `${JA_QUALITY}下限`,
    blessingsChooseButton: `${JA_BLESSINGS}を選択する`,
    blessingsCountButton: (n) => `${JA_BLESSINGS}（${n}）`,
    blessingsModalTitle: `必要な${JA_BLESSINGS}`,
    blessingsDoneButton: 'OK',
    blessingsCapNote: (max) => `${JA_EQUIPMENT}できる上限です（${max}）`,
    blessingsGreyedNote: `選択不可：選択した${JA_EQUIPMENT}の該当${JA_BLESSINGS}なし`,
    qualityListTooltip: `選択したいずれかの${JA_QUALITY}`,
    mustCarryAllTooltip: 'これらすべて必須',
    gradeTooltipLabel: (gradeNames) => `${JA_GRADE}：${gradeNames}`,
    narrowedNote: `このガラクタが実際に出す${JA_EQUIPMENT}に絞り込みました。`,
    junkDetailsTitle: 'ガラクタの詳細',
    multiPoolNote: [
      '表示されている数字は、このガラクタの最新版のものです。',
      'このエリアの新しいプールを解放していない場合、',
      'または前のバージョンのガラクタが手元に残っている場合、',
      '実際のドロップは異なることがあります。',
    ].join(''),
    curveLoadError: (junkNeeded) => (
      `障害により正確な数字がでませんでしたが、およそ${junkNeeded}個必要です`
    ),
    chancePerJunk: 'ガラクタ1個あたりの確率',
    seeFullDetailsButton: 'ガラクタの詳細を見る',
  },
  lists: {
    junkTitle: 'ガラクタ',
    equipmentTitle: JA_EQUIPMENT,
    columnEquipment: JA_EQUIPMENT,
    columnCategory: JA_CATEGORY,
    columnRank: JA_RANK,
    columnMaxQuality: '最高★',
    columnMaxGrade: `最高${JA_GRADE}`,
    columnDrops: 'ドロップ数',
    columnSources: 'ソース数',
    columnNotes: '備考',
    uncategorisedLabel: '未判明',
    multiplePoolsLabel: '複数プール',
    junkLoadError: 'ガラクタリストを読み込めませんでした。更新してみてください。',
    equipmentLoadError: `${JA_EQUIPMENT}リストを読み込めませんでした。更新してみてください。`,
    junkSearchPlaceholder: 'ガラクタを名前で絞り込み',
    junkEmptyMessage: '一致するガラクタがありません',
    equipmentSearchPlaceholder: `${JA_EQUIPMENT}を名前で絞り込み`,
    equipmentEmptyMessage: `条件に合う${JA_EQUIPMENT}がありません`,
    allRanksOption: `すべての${JA_RANK}`,
    filterByRankAriaLabel: `${JA_RANK}で絞り込み`,
  },
  detail: {
    equipmentDetailsTitle: `${JA_EQUIPMENT}の詳細`,
    junkDetailsTitle: 'ガラクタの詳細',
    junkNeededByCertainty: `${JA_CERTAINTY}ごとの必要ガラクタ数`,
    nameHeader: '名前',
    qualityHeader: JA_QUALITY,
    gradeHeader: JA_GRADE,
    rankLabel: JA_RANK,
    maxLabel: '最高',
    junkSourcesLabel: '入手元のガラクタ',
    dropsFromNJunk: (n) => `${n}種類のガラクタから入手`,
    noJunkDrops: 'ここから出るガラクタはないわ',
    atBestDrops: '最高',
    dropsNPieces: (n) => `${n}種類の${JA_EQUIPMENT}を出します`,
    noDroppableGear: `記録されているドロップ${JA_EQUIPMENT}はありません`,
  },
  about: {
    title: (appName) => `${appName}について`,
    introBody: (appName, oracleName) => [
      `${appName} は、「ウィザードリィ ヴァリアンツ ダフネ」で欲しい装備を確実に手に入れ`,
      `るために必要なガラクタ数を計算するツールです。${oracleName} で欲しい${JA_EQUIPMENT}を選ぶだけで、`,
      `ガラクタをいくつ集めればいいかがすぐに分かります。また、ガラクタと${JA_EQUIPMENT}の一覧では、`,
      `ゲームデータを検索しやすい形で閲覧できます。`,
    ].join(''),
    guaranteeHeading: '「確実性」について',
    guaranteeBody: (oracleName) => [
      `${oracleName} は、「目標とするドロップ確率を達成するには、ガラクタを何個集めればいい か」を計算しますが、ドロップは100%確実ではありません。`,
      `確率は限界まで高く設定できますが、最後に結果を決めるのはやはり運(RNG)です。`,
    ].join(''),
    twoThingsHeading: '覚えておいていただきたい2つのこと',
    blessingOddsLead: '追加護の出現率はある仮定条件に基づいて計算しています。',
    blessingOddsRest: [
      '開発元は各スロットの追加護の付与確率を公開していますが、追加護が付与された場合、それ以降の追加護がどう処理されるかは公表されていません。',
      '当ツールでは、すでに付与された追加護を対象から除外し、再度スロットを引き直すと仮定しています。',
      '仮に、すでに付与された追加護も除外せずに再度スロットを引き直す仕様だったとしても、結果の差異は1%未満であり、最大でも約10%程度です。',
    ].join(''),
    multiplePoolsLead: '一部のガラクタには複数のバージョンが存在します。',
    multiplePoolsRest: [
      '一部のガラクタは、ゲームのアップデートによりドロップ内容が変更されています。当ツールでは最新のドロップ内容を採用しています。まだ対象エリアでの新プールが解放されていない場合は、実際のドロップ内容は当ツール結果と異なる可能性があります。ガラクタに複数バージョンある場合はその旨を注記します。',
    ].join(''),
    contributeHeading: 'ツール機能向上のために',
    contributeIntro: (appName, oracleName) => [
      `${appName}はオープンソースであり、コードや計算方式などはすべて公開しています。
      ${oracleName}の`,
      'ほぼすべての数値は、次の2つの式から導いています。：',
    ].join(''),
    formulaExplanation: [
      'ひとつめは、装備の出現率がPのとき、確率cに到達するのに必要なガラクタの数を計算する式です。',
      'ふたつめは、装備に追加護を付与する際のスロットの計算式です。スロットは1つずつ順番に引かれ、同じ追加護が重複して出ることはありません。スロットでは順次まだ引かれていない追加護のみを対象に出現率の再計算をします。',
    ].join(''),
    docsReferenceLabel: '詳細はこちら：',
    calculationDocLinkLabel: '計算ドキュメント（英語）',
    domainDocLinkLabel: 'ドメインドキュメント（英語）',
    askForHelpBody: [
      '当ツールについて何かお気づきの点がございましたらご一報ください。実際のゲームプレイと当ツールがうまく対応していないなど、私たちの気づかない不具合について、教えていただけたら幸いです。',
    ].join(''),
    issueLinkLabel: '不具合または修正の要望を送る',
    githubButton: (appName) => `GitHubの${appName}`,
    dataPrivacyHeading: 'データおよびプライバシー',
    dataPrivacyPrefix: 'ドロップ率のデータは',
    officialListsLinkLabel: 'ゲーム開発元提供の公式リスト',
    dataPrivacyMiddle: 'を参照しています。装備の詳細は',
    fasterthoughtsLinkLabel: 'Fasterthoughtsガイド',
    dataPrivacySuffix: [
      'を参照しています。装備リストを作成してくださったNRJankとFasterthoughtsの',
      'みなさんに感謝の意を表します。',
    ].join(''),
    privacyBody: [
      '私たちはどの機能がユーザーの役に立っているか知るために、最小限の匿名利用統計データのみを集めています。アカウント登録は不要で、',
      'ユーザ－のデータを第三者に売買することも絶対にありません。当ツールへの訪問履歴の紐づけも',
      '追跡用クッキーも一切設定していません。端末に保存するのは言語設定のみ（言語を選択した場合）です。',
      'そのため、当ツールにはクッキーへの同意を求めるようなポップアップは表示されません。',
    ].join(''),
    analyticsLinkLabel: 'アクセス解析についての詳細情報',
    supportHeading: 'ご支援のお願い',
    supportBody: (appName) => [
      `「${appName}」は完全無料で、日本在住のメキシコ人ソフトウェアエンジニアが個人で運営しています。`,
      '当ツールの運営を維持するには年間4千２百円のサーバー費用がかかります。そのため、もし9人の方からコーヒー1杯分のご支援をいただければ、1年ぶんの運営費をまかなうことができます。',
      'いただいたご支援は、子どもたちの就寝後のツール開発の励みになります。もちろん、経済的なご支援だけでなく、サイトを利用していただくだけでも同志として大歓迎です。これからも、このアプリが有料になることはありません。',
    ].join('\n'),
    supportButtonLabel: 'このプロジェクトを支援する',
    creditsHeading: '制作クレジット',
    creditsBody: [
      '装備アイコンはLorc、Delapouite、および有志が制作したgame-icons.netのものを、',
      'CC BY 3.0に基づき使用しています。インターフェース用アイコンはTabler Icons（MITライセンス）のものです。',
    ].join(''),
    disclaimer: [
      'はファンが制作した非公式のツールであり、「ウィザードリィ ヴァリアンツ ダフネ」の開発・運営元とは一切関係なく、公認されたものでもありません。',
    ].join(''),
  },
  notices: {
    equipmentLocalizationCaveat: [
      'ガラクタからドロップする装備品のみ名前が翻訳されています。それ以外のものは英語表記のままとなります。',
    ].join(''),
  },
  maintenance: {
    subtitle: 'ウィザードリィ ヴァリアンツ ダフネ アシスタント',
  },
  dataFreshness: {
    tooltipLabel: '最終更新日',
    ariaLabel: 'データの更新状況と情報元',
  },
  vocab: {
    gradeName: {
      1: '白',
      2: '緑',
      3: '青',
      4: '紫',
      5: '赤',
    },
    rankName: {
      [EquipmentRankKind.WORN]: 'くたびれた',
      [EquipmentRankKind.BRONZE]: '青銅',
      [EquipmentRankKind.IRON]: '鉄',
      [EquipmentRankKind.STEEL]: '鋼',
      [EquipmentRankKind.EBONSTEEL]: '冥鋼',
      [EquipmentRankKind.SILVER]: '銀',
    },
    blessingLabel: (statKind, isPercent) => (
      isPercent ? `${JA_STAT_LABEL[statKind]}％` : JA_STAT_LABEL[statKind]
    ),
    categoryName: JA_CATEGORY_NAME,
    equipmentTypeName: JA_EQUIPMENT_TYPE_NAME,
  },
} satisfies UiStrings;
