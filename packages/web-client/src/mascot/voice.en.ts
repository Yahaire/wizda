import { TsUtilities } from '@shared/tsUtilities';

import type { WizdaLines } from './voice';

/**
 * Wizda's lines, in English. Keep them in her voice: warm, a little cheeky, and
 * Wizardry-lore-aware (Agora, "junk", grade colours). See `docs/wizda-voice.md`
 * before adding or reworking any line — this is the whole of what she says.
 */
export const wizdaLinesEn = {
  greet: {
    welcome: "Welcome! I'm Wizda — Hope I can help you on your adventure.",
    daily: [
      "Back for more delving? Let's find your treasure.",
      "The abyss runs deep today — good thing I do the math so you don't have to.",
      "Another day, another pile of junk to sort. Let's get you that gear.",
      "May your pulls be blessed and your grades be red.",
      "Welcome back, adventurer. Agora's watching — but I'm the one with the numbers.",
      "Ready to reverse some junk? I've got the odds.",
      "A wise delver farms smart, not hard. That's where I come in.",
      "New day, fresh luck. Let's see what you're hunting.",
    ],
  },
  oracle: {
    tagline: "Want to know how much junk you need for that shiny 4★ axe?",
    snark: "I'm not showing all that! Pick a filter or two and save me some work?",
    agoraLine: "Remember — not even GREAT Agora can guarantee you'll get it!",
    loadError: "Wait! Don't look! I couldn't load the gear list — refresh and I'll try again.",
    emptyPrompt: "Pick what you're after, then hit Calculate and I'll count the junk for you.",
    estimateNote: TsUtilities.stringJoin([
      "Blessings fill one slot at a time, and no piece ever gets the same one twice.",
      "The devs publish each slot's odds, but never say what happens exactly after the first slot is filled.",
      "I assume the game simply rerolls that slot.",
      "If it starts the whole piece over instead, my numbers drift a little — usually by",
      "well under 1%, and at worst by about a tenth. Everything else here is exact.",
    ]),
    estimateNoteLink: "Want to check my calculations — or know how the game really rolls?",
    endOfList: "That's all I got!",
    noResults: "No junk can get you that one — try loosening the filters a little.",
    blessingsHelp: TsUtilities.stringJoin([
      "Pick every blessing the item must carry —",
      "I'll only count pieces that have all of them.",
    ]),
    filterHelp: {
      equipment: TsUtilities.stringJoin([
        "Pick the gear you're hunting.",
        "I'll rank every junk that can drop any piece you choose — so you can chase a few at once.",
      ]),
      quality: TsUtilities.stringJoin([
        "Quality is the star count, 1★ up to 5★.",
        "Higher quality means bigger blessing values on the piece.",
        "Set the lowest you'd be happy to walk away with — I'll count everything from there up.",
      ]),
      grade: TsUtilities.stringJoin([
        "Grade shows in-game as a colour: White, Green, Blue, Purple, then Red.",
        "It sets how many blessing slots are active — White has none, and each colour up adds one, so Red holds four.",
        "Set the lowest grade you'd be happy to walk away with — I'll count everything from there up.",
      ]),
      blessings: TsUtilities.stringJoin([
        "Blessings are the bonus stats a piece can roll.",
        "I only count gear that carries ALL the blessings you pick.",
        "A single piece holds at most four, so that's the cap.",
        "Not every piece rolls every blessing — a sword will never carry DEF —",
        "so I grey out the ones your gear can't reach.",
      ]),
      category: TsUtilities.stringJoin([
        "The kind of gear — daggers, heavy armor, shoes, that sort of thing.",
        "Pick any categories you'd take, and I'll only count junk that drops them.",
        "I only list the kinds junk hands out at all, so you won't find Tools here.",
      ]),
      rank: TsUtilities.stringJoin([
        "A gear's rank — its material, from Bronze up to Silver.",
        "Some folks call it \"tier\" — just don't mix it up with your adventurer rank!",
        "Pick every rank you'd be happy with.",
        "I leave out Worn, since since it's so bad not even junk can hand you one.",
      ]),
      certainty: TsUtilities.stringJoin([
        "How sure you want to be before you stop grinding.",
        "90% means that, nine times out of ten, you'd have the item by the number I show.",
        "Just know, not even GREAT Agora can promise you 100%!",
      ]),
    },
  },
  errors: {
    unknownEquipment: "Some of that gear isn't in my notes anymore — try reselecting it.",
    unknownBlessing: "One of those blessings isn't in my notes anymore — try reselecting it.",
    generic: "Something went sideways on my end — give it another go in a moment.",
  },
  about: {
    intro: "Hi! I'm Wizda. Let me save you the tedious inventory math.",
  },
  credits: {
    thanks: TsUtilities.stringJoin([
      "Special thanks to NRJank and the Fasterthoughts team for compiling and maintaining",
      "the gear lists — your work makes this possible!",
    ]),
  },
  confirm: {
    tidyLabel: "Tidy up",
    leaveLabel: "Leave it",
    identityNoOverlap: TsUtilities.stringJoin([
      "Your gear, category, and rank picks don't overlap — nothing is all three at once.",
      "I can drop the category and rank and keep the gear you named.",
    ]),
    genericConflict: "Some of your picks don't fit together anymore.",
    blessingUnrollableOne: (labels) => `Nothing you've picked ever rolls ${labels}.`,
    blessingUnrollableMany: (labels) => `Nothing you've picked rolls ${labels}.`,
    blessingComboUnrollable: (labels) => TsUtilities.stringJoin([
      `No single piece you've picked carries ${labels} together,`,
      "and a blessing only counts if it's on the piece you're hunting.",
    ]),
    blessingFloorPhrase: (count, gradeName, atMax) => {
      const subject = count === 1 ? "1 blessing needs" : `${count} blessings need`;
      const target = atMax ? gradeName : `${gradeName} or better`;
      return `${subject} ${target}`;
    },
    gradeFloorTooHigh: (floorPhrase) => TsUtilities.stringJoin([
      `${floorPhrase}, and that gear never drops that high.`,
      "Ask for fewer blessings, or grind something else.",
    ]),
    gradeTooHigh: (gradeName) => `I don't think that gear ever drops as high as ${gradeName}.`,
    qualityTooHigh: (qualityLabel) => `Selected gear doesn't seem to reach ${qualityLabel}.`,
  },
} satisfies WizdaLines;
