import {
    JA_BLESSINGS, JA_CATEGORY, JA_EQUIPMENT, JA_GRADE, JA_QUALITY, JA_RANK
} from '@/i18n/glossary.ja';
import { TsUtilities } from '@shared/tsUtilities';

import type { WizdaLines } from './voice';

/**
 * Separate strings with an empty space by default.
 * Accepts a custom separator if needed.
 */
const stringJoin = (
  parts: string[],
  separator: string = "",
): string => TsUtilities.stringJoin(parts, separator);

/**
 * Wizda's lines, in Japanese. A parallel of `voice.en.ts` — same shape,
 * `satisfies WizdaLines` so nothing can go missing. Keep her in character:
 * warm, a little cheeky, and Wizardry-lore-aware (アゴラ, ガラクタ, グレードの色).
 * See `docs/wizda-voice.md` and `docs/glossary.md`. Revised by a native,
 * game-literate editor; lines marked `★` are still being reworked.
 */
export const wizdaLinesJa = {
  greet: {
    welcome: "ようこそ！ 私はウィズダ。ここの管理人の妖精よ。あなた様の冒険のお手伝いをさせてね。",
    daily: [
      "今日も探索に来たの？ じゃ、一緒にお宝を見つけにいきましょう。",
      "今日は深淵が深いみたい…計算は得意だから、私にまかせてね。",
      `また新しいガラクタの山だわ。さあ、あなた様のお目当ての${JA_EQUIPMENT}を一緒に探しましょう。`,
      `あなた様の引きに祝福あれ、${JA_GRADE}が赤くなりますように！`,
      "おかえりなさい、冒険者様。アゴラ様が見ているけど、数字のことなら私のほうが得意よ。",
      "逆転の準備はできた？確率は私に任せて。",
      "周回は気合いじゃない、効率よ。そのために私が一緒にいるんでしょ？",
      "さあ、新しい一日よ。今日は何を狙うの？",
    ],
  },
  oracle: {
    tagline: `その4★の${JA_EQUIPMENT}に、ガラクタはいくつ必要か知りたくない？`,
    snark: "全部表示は無理！ フィルターを1つか2つ選んでから、もう一度やってみてね。私にも少し楽させて！",
    agoraLine: "忘れないで。偉大なアゴラ様でも、欲しいものが絶対に手に入るって確約はできないのよ。",
    loadError: `ちょっと待って！ ${JA_EQUIPMENT}リストが読み込めなかったの。更新してくれたら、もう一度試してみるわ。`,
    emptyPrompt: "欲しい装備を選んで「計算」を押してね。必要なガラクタがいくつか数えてあげるわ。",
    emptyPromptWithPicks: "あなた様が選んだものはそのまま残ってるわ。準備ができたら「計算」を押してね。",
    popularHeading: "だれか他の人の選択を読み込んでもいいのよ。",
    estimateNote: stringJoin([
      `${JA_BLESSINGS}スロットの枠には常に違う${JA_BLESSINGS}が来るようになってるの。つまり、${JA_EQUIPMENT}に同じ${JA_BLESSINGS}が重複してつくことはないわ。`,
      `開発元は各スロットの${JA_BLESSINGS}のつく確率を公開しているけど、ひとつめの${JA_BLESSINGS}がでた後、それ以降の${JA_BLESSINGS}がどうやって処理されるかは言っていないわ。`,
      `だから私は、1回でた${JA_BLESSINGS}を省いてスロットを引き直す、って考えて計算してるの。`,
      `もし他の方法で計算していても、計算結果はあまり変わらないわ。大体の場合は1%未満、最大でも10%ぐらいの誤差よ。`,
      "それ以外の計算はすべて正確だから、心配しないで。",
    ]),
    estimateNoteLink: "私がどうやって計算してるか知りたい？",
    endOfList: "これで全部よ。",
    noResults: "ええっと…その装備を出せるガラクタはないみたいだわ。もう少し条件を緩めてみて。",
    filterSearchesLoadedOnly: stringJoin([
      "気をつけて。私が探すのはもう掘り出したガラクタだけだから。",
      "もし欲しいものがここになければ、「もっと見る」のボタンを押してね。",
    ]),
    noFilterMatches: "今のところ掘り出したガラクタのなかに、当てはまるものはないわ。",
    blessingsHelp: stringJoin([
      `${JA_EQUIPMENT}に必ずついていてほしい${JA_BLESSINGS}を全部選んでね。`,
      `それがついている${JA_EQUIPMENT}だけ数えるわ。`,
    ]),
    filterHelp: {
      equipment: stringJoin([
        `狙っている${JA_EQUIPMENT}を選んでね。`,
        "それが手に入るガラクタを私がランク付けするわ。これなら同時にいくつも集められて、便利でしょう？",
      ]),
      quality: stringJoin([
        `${JA_QUALITY}は星の数、1★から5★まであるのよ。`,
        `${JA_QUALITY}が高いほど、${JA_EQUIPMENT}につく${JA_BLESSINGS}の値が大きくなるわ。`,
        "妥協できる最低ラインを決めてね。そこから上のものを数えるわ。",
      ]),
      grade: stringJoin([
        `${JA_GRADE}はゲーム内の色になってて、白、緑、青、紫、そして赤の順よ。`,
        `色によって使える${JA_BLESSINGS}のスロット枠が決まるんだけど、白はゼロ、色がひとつ変わるごとにひとつ増えて、赤は4つのスロット枠があるわ。`,
        `妥協できる最低ラインの${JA_GRADE}を決めてね。そこから上のものを数えるわ。`,
      ]),
      blessings: stringJoin([
        `${JA_BLESSINGS}は${JA_EQUIPMENT}につく追加のボーナスステータスのことよ。`,
        `あなた様が選んだ${JA_BLESSINGS}がすべてついている${JA_EQUIPMENT}だけを数えるわ。`,
        `ひとつの${JA_EQUIPMENT}につけられるのは最高で4つ、それが上限よ。`,
        `でも、どの${JA_EQUIPMENT}も好きな${JA_BLESSINGS}をつけられるわけじゃないの。例えば、剣は普通「防御」の${JA_BLESSINGS}をつけることはできない、とか。`,
        `だから、選んだ装備につけられない${JA_BLESSINGS}は選択不可にしておくわ。`,
      ]),
      category: stringJoin([
        `次は${JA_EQUIPMENT}の${JA_CATEGORY}よ。短剣とか、重鎧とか、靴とか。`,
        "あなた様が望む種類を選んだら、それをドロップするガラクタだけ数えてあげるわ。",
        "ちなみに、ちゃんとガラクタから手に入る種類しか載せていないから、「道具」は入っていないわよ。",
      ]),
      rank: stringJoin([
        `${JA_EQUIPMENT}の${JA_RANK}について、これは素材のこと。青銅から銀まであるわ。`,
        "「ティア」って呼ぶ人もいるけど、冒険者ランクとはちがうから、間違えちゃダメよ。",
        `いいと思う${JA_RANK}を全部選んでね。`,
        `ちなみにぼろい${JA_EQUIPMENT}は除外してあるわ。いくらガラクタでも出せないくらいダメダメだから。`,
      ]),
      certainty: stringJoin([
        "周回を終える前に、どれくらい確実にしたいか、ね。",
        `例えば、90%に設定するなら、10回中9回は、私が表示した回数までにその${JA_EQUIPMENT}が手に入っているということ。`,
        "あ、でも、偉大なアゴラ様でも100%の確約はできないからね。",
      ]),
    },
  },
  errors: {
    unknownEquipment: `あれ…？その${JA_EQUIPMENT}、私の手帳から消えちゃってるみたい。もう1回選び直してみて！`,
    unknownBlessing: `あれ…？その${JA_BLESSINGS}、私の手帳から消えちゃってるみたい。もう1回選び直してみて！`,
    unknownGearKind: `その${JA_CATEGORY}や${JA_RANK}は、まだわたしの手帳にないみたい。絞り込みのフィルターから除外しておいたわ。`,
    generic: "ちょっと私の調子がよくなかったみたい。ごめんね、少し待ってもう一度試してみて。",
  },
  away: {
    title: "新しい情報を探しに王都までお出かけ中！数分したらまた覗いてみて！",
    back: "ただいま！帰ってきたわ。",
  },
  about: {
    intro: "こんにちは！ 私はウィズダ。面倒な在庫の計算はわたしにまかせてね。",
  },
  credits: {
    thanks: stringJoin([
      `${JA_EQUIPMENT}リストをまとめて、ずっと管理してくれているNRJankさんとFasterthoughtsチームに感謝します。`,
      "皆さんのおかげで、私がこんな風に働けているの！",
    ]),
  },
  share: {
    copied: "リンクをコピーしたわ！誰かに教えてあげて。",
    failed: "あら、うまくコピーできなかったみたい…アドレスバーから直接コピーしてみて。",
    tooLarge: "あら、検索情報が大きすぎて共有リンクが作成できないみたい…かわりに画像を共有してみてね。",
  },
  data: {
    freshness: (age) => stringJoin([
      `${age}前に、ルクナリアの王立図書館と、街の記録係から情報を聞いて手帳の記入を更新したわ。`,
    ]),
    freshnessNote: (age) => `${age}前に公式とコミュニティからの情報を更新。`,
    freshInk: "まだインクの新しい匂いがするでしょ！",
  },
  confirm: {
    tidyLabel: "削除する",
    leaveLabel: "そのままにする",
    identityNoOverlap: stringJoin([
      `${JA_EQUIPMENT}・${JA_CATEGORY}・${JA_RANK}の選択がうまく噛み合っていないわ。`,
      `${JA_CATEGORY}と${JA_RANK}の選択を外して、指定した${JA_EQUIPMENT}だけを残すこともできるけど…どうする？`,
    ]),
    genericConflict: "選んだ条件のなかに、なにか矛盾してるものがあるみたい。",
    blessingUnrollableOne: (labels) => `あなた様が選んだ条件だと、どうやっても${labels}の${JA_BLESSINGS}はつかないわ。`,
    blessingUnrollableMany: (labels) => `あなた様が選んだ条件だと、どうやっても${labels}の${JA_BLESSINGS}はつかないわ。`,
    blessingComboUnrollable: (labels) => stringJoin([
      `あら！あなた様が選んだ ${JA_EQUIPMENT}のなかに、${labels}が一緒につくものはないわ。`,
      `${JA_BLESSINGS}は狙っている${JA_EQUIPMENT}についてこそ意味があるの。`,
    ]),
    blessingFloorPhrase: (count, gradeName, atMax) => {
      const subject = count === 1 ? `${JA_BLESSINGS}が1つ` : `${JA_BLESSINGS}が${count}つ`;
      const target = atMax ? gradeName : `${gradeName}以上`;
      return `${subject}なら${target}が必要だわ。`;
    },
    gradeFloorTooHigh: (floorPhrase) => stringJoin([
      `条件は${floorPhrase}だけど、その${JA_EQUIPMENT}だとそんなに高いグレードではドロップしないみたい。`,
      `${JA_BLESSINGS}の数を減らすか、別のガラクタを周回しないといけないわ。`,
    ]),
    gradeTooHigh: (gradeName) => `えっと…その${JA_EQUIPMENT}が${gradeName}みたいな高いグレードで出るっていうのは、私の手帳では見つけられないわ。`,
    qualityTooHigh: (qualityLabel) => `あなた様が選んだ${JA_EQUIPMENT}はどうやっても${qualityLabel}には届かないみたい。`,
  },
} satisfies WizdaLines;
