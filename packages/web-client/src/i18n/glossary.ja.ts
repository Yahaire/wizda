/**
 * Canonical Japanese terms for the game's core nouns — the single source of
 * truth shared by the UI-chrome catalog (`strings.ja.ts`) and Wizda's voice
 * (`mascot/voice.ja.ts`), so one concept is never named two ways. Each is the
 * confirmed in-game term; see `docs/glossary.md`.
 *
 * Consistency matters more in JA than EN: a stray English loanword or a synonym
 * swap may read as noise to a player.
 *
 * One substring is deliberately NOT folded into these consts: 冒険者ランク
 * (Adventurer rank) is a distinct concept from gear `JA_RANK`.
 */
export const JA_EQUIPMENT = "装備"; // a piece of gear
export const JA_CATEGORY = "装備種別"; // the *kind* of gear — not katakana カテゴリ
export const JA_RANK = "ランク"; // material band (Bronze→Silver) — cf. 冒険者ランク
export const JA_QUALITY = "品質"; // star rating — the in-game term, not クオリティ
export const JA_GRADE = "グレード"; // colour tier (White→Red)
export const JA_BLESSINGS = "追加護"; // a blessing — the standard JA term (not bare 護)
export const JA_CERTAINTY = "確実性"; // target confidence the guarantee aims fo