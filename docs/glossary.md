# Wizda glossary — in-game terms across languages

A comparative reference so anyone revising a language catalog (`packages/web-client/src/i18n/strings.<lang>.ts` and the Wizda voice at `src/mascot/voice.<lang>.ts`) uses the same wording the game and its community use — not a literal dictionary translation. When in doubt, prefer the term a player of that language's client would recognize.

**How this feeds the code.** English is the source of truth for every data key (equipment/junk `name`), so translations are *display only* — see [domain.md](domain.md)'s "Localized names". The game-vocab columns below are the source for the `vocab` block in each `strings.<lang>.ts` (grade colours, rank materials) and guide the prose in `voice.<lang>.ts`. Equipment and junk *names* are not hand-translated here — they come from the official localized drop-rate pages via the seed.

**Searching in another language** — how a player typing kana, kanji or romaji reaches an item — is a separate concern with its own decisions; see [search.md](search.md).

**Columns.** *EN main / JA main* are what the UI ships today; *alternates* are other acceptable or community terms a reviewer might prefer. Fill in blanks and correct anything below as a native/game-literate editor — the first pass was written by a non-native author and is expected to need revision.

## Core concepts

| Term | Description | EN main | EN alternates | JA main | JA alternates |
| --- | --- | --- | --- | --- | --- |
| Junk | The loot boxes players farm and "reverse" into gear | Junk | loot box | ガラクタ | — |
| Reverse | To open a junk box, converting it into a piece of equipment | Reverse | open | 逆転 | — |
| Blessing | Bonus stat rolled onto a piece of gear (max 4, one per active slot) | Blessing | bonus stat | 追加護 | slot: 追加護枠 |
| Slot | An active blessing slot on a piece of gear; starting count is set by Grade, but all equipment has 4 after being fully upgraded | Slot | blessing slot | スロット | 追加護枠 |
| Quality | Star rating 1★–5★; scales blessing magnitude | Quality | stars | クオリティ | 星 (stars) |
| Grade | Colour tier (White→Red) setting how many blessing slots are active | Grade | — | グレード | — |
| Rank | Material band of a piece (Bronze→Silver); the game's own word | Rank | tier, material | ランク | ティア |
| Adventurer rank | A separate character-level "Rank" — **not** the gear rank | Adventurer rank | — | 冒険者ランク | — |
| Equipment | A piece of gear | Equipment | gear | 装備 | — |
| Category | The kind of gear (dagger, heavy armor, …) | Category | type | 装備種別 | カテゴリ, 種類 |
| Certainty | Target confidence the guarantee math aims for | Certainty | confidence | 確実性 | — |
| Luknalia | The royal capital (lore flavour in Wizda's voice) | Luknalia | the royal capital | ルクナリア | — |
| GREAT Agora | A patron figure the community invokes for luck | GREAT Agora | Agora | 偉大なアゴラ | アゴラ |

## Grade colours (grade value → colour)

Backs `vocab.gradeName` in each `strings.<lang>.ts`. Values are 1–5.

| Grade | Active blessing slots | EN main | JA main | JA alternates |
| --- | --- | --- | --- | --- |
| 1 | 0 | White | 白 | — |
| 2 | 1 | Green | 緑 | — |
| 3 | 2 | Blue | 青 | — |
| 4 | 3 | Purple | 紫 | — |
| 5 | 4 | Red | 赤 | — |

## Rank materials (rank kind → material)

Backs `vocab.rankName`. `Worn` never drops from junk, so it rarely surfaces.

| Rank kind | EN main | JA main | JA alternates |
| --- | --- | --- | --- |
| WORN | Worn | くたびれた | 使い古した |
| BRONZE | Bronze | 青銅 | — |
| IRON | Iron | 鉄 | — |
| STEEL | Steel | 鋼 | — |
| EBONSTEEL | Ebonsteel | 冥鋼 | — |
| SILVER | Silver | 銀 | — |

## Blessing stat names (short label)

Backs `vocab.blessingLabel`. Confirmed against the in-game blessing dropdown, which reads e.g. "ATK Increase (%)" / "攻撃力上昇（％）". We show just the noun in both languages — the same compactness trade-off as the EN "ATK" abbreviation — since the full official phrasing (base + Increase/上昇 + parenthesized unit) is too long for the chip grid. The percent variant appends a full-width `％`, matching the official readout's "（％）"/"（固定）" suffix.

| StatKind | EN short | JA short |
| --- | --- | --- |
| ATK | ATK | 攻撃力 |
| MAG | MAG | 魔力 |
| DIV | DIV | 神力 |
| ACC | ACC | 命中 |
| EVA | EVA | 回避 |
| RES | RES | 抵抗 |
| DEF | DEF | 防御力 |
| MDEF | MDEF | 魔術防御力 |
| ASPD | ASPD | 行動速度 |
| SUR | SUR | 会心 |

## Equipment types (broad group)

Backs `vocab.equipmentTypeName`. Used as the category filter's group headers. The game's own broad grouping only goes as far as Weapons/Armor/Accessories — **WEAPON and ACCESSORY are confirmed** (装飾品 is the same word the ACCESSORIES category uses); the game never subdivides "Armor" the way our filter does, so **SHIELD/HELMET/GLOVES/CHEST_ARMOR/BOOTS have no official text to check against** and stay best-effort. Those five use the umbrella word 防具 ("gear/armor") rather than each slot's category-level noun (兜/篭手/鎧/足鎧) because every one of those type groups also holds a non-armor casual piece (Hat/Gloves/Clothes/Shoes, respectively) that the narrower noun wouldn't cover.

| Type kind | EN main | JA main | Status |
| --- | --- | --- | --- |
| WEAPON | Weapons | 武器 | confirmed |
| SHIELD | Shields | 盾 | best-effort |
| HELMET | Helmets | 頭防具 | best-effort |
| GLOVES | Gloves | 手防具 | best-effort |
| CHEST_ARMOR | Chest Armor | 胴防具 | best-effort |
| BOOTS | Boots | 足防具 | best-effort |
| ACCESSORY | Accessories | 装飾品 | confirmed |

## Equipment categories

Backs `vocab.categoryName`. Confirmed against in-game category dropdown screenshots.

| Category code | EN main | JA main |
| --- | --- | --- |
| DAGGER | Dagger | 短剣 |
| ONE_HANDED_SWORD | One-Handed Sword | 片手剣 |
| ONE_HANDED_AXE | One-Handed Axe | 片手斧 |
| ONE_HANDED_STAFF | One-Handed Staff | 片手杖 |
| ONE_HANDED_BLUNT_WEAPON | One-Handed Blunt Weapon | 片手鈍器 |
| THROWING_NINJA_TOOL | Throwing Ninja Tool | 投擲忍具 |
| NINJATO | Ninjato | 忍者刀 |
| KATANA | Katana | 刀 |
| TWO_HANDED_SWORD | Two-Handed Sword | 両手剣 |
| TWO_HANDED_AXE | Two-Handed Axe | 両手斧 |
| TWO_HANDED_STAFF | Two-Handed Staff | 両手杖 |
| TWO_HANDED_BLUNT_WEAPON | Two-Handed Blunt Weapon | 両手鈍器 |
| TWO_HANDED_SPEAR | Two-Handed Spear | 両手槍 |
| BOW | Bow | 弓 |
| ODACHI | Odachi | 大太刀 |
| TOOLS | Tools | 工具 |
| SMALL_SHIELD | Small Shield | 小盾 |
| LIGHT_SHIELD | Light Shield | 軽盾 |
| HEAVY_SHIELD | Heavy Shield | 重盾 |
| HAT | Hat | 帽子 |
| LIGHT_HELMET | Light Helmet | 軽兜 |
| HEAVY_HELMET | Heavy Helmet | 重兜 |
| GLOVES | Gloves | 手袋 |
| LIGHT_GAUNTLETS | Light Gauntlets | 軽篭手 |
| HEAVY_GAUNTLETS | Heavy Gauntlets | 重篭手 |
| CLOTHES | Clothes | 衣服 |
| LIGHT_ARMOR | Light Armor | 軽鎧 |
| HEAVY_ARMOR | Heavy Armor | 重鎧 |
| SHOES | Shoes | 靴 |
| LIGHT_ARMOR_BOOTS | Light Armor Boots | 軽足鎧 |
| HEAVY_ARMOR_BOOTS | Heavy Armor Boots | 重足鎧 |
| ACCESSORIES | Accessories | 装飾品 |

## Notes for reviewers

- **Stars.** Quality is drawn as ★ glyphs in the UI regardless of language, so the word (クオリティ / 星) mostly appears in help text and column headers.
- **Grade colours** are shown as coloured swatches; the colour *word* appears in the readout and tooltips. Keep it to a single glyph/word where the badge abbreviates (the badge shows the first 3 characters).
