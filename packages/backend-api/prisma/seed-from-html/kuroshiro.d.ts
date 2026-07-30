/**
 * Ambient types for `kuroshiro` + `kuroshiro-analyzer-kuromoji`, neither of
 * which ships declarations and neither of which has a `@types/*` package (both
 * checked — 404). Hand-written to cover only the sliver of the API
 * `seedJapaneseReadings` uses; widen it if a later caller needs more.
 *
 * Deliberately colocated here rather than in a shared `types/` dir: these
 * packages must never be imported from `src/` (they pull kuromoji's ~41 MB
 * IPADIC dictionary), so keeping the declarations next to the sole consumer
 * makes an accidental import in the API somewhere it would stand out.
 */

declare module 'kuroshiro' {
  /** Output script for {@link Kuroshiro.convert}. */
  export type KuroshiroTargetSyllabary = 'hiragana' | 'katakana' | 'romaji';

  export interface KuroshiroConvertOptions {
    to?: KuroshiroTargetSyllabary,
    mode?: 'normal' | 'spaced' | 'okurigana' | 'furigana',
    romajiSystem?: 'nippon' | 'passport' | 'hepburn',
    delimiter_start?: string,
    delimiter_end?: string,
  }

  /** The analyzer instance {@link Kuroshiro.init} is handed; see the kuromoji module below. */
  export interface KuroshiroAnalyzer {
    parse(text: string): Promise<unknown>,
  }

  export default class Kuroshiro {
    init(analyzer: KuroshiroAnalyzer): Promise<void>;
    convert(text: string, options?: KuroshiroConvertOptions): Promise<string>;
  }
}

declare module 'kuroshiro-analyzer-kuromoji' {
import { KuroshiroAnalyzer } from 'kuroshiro';

    export interface KuromojiAnalyzerOptions {
    /** Directory holding the IPADIC `.dat.gz` files. Resolved off `kuromoji`'s own package root. */
    dictPath?: string,
  }

  /**
   * `module.exports` is the constructor itself (no `__esModule`, no `.default`),
   * so this is an `export =` that `esModuleInterop` lets callers default-import.
   */
  class KuromojiAnalyzer implements KuroshiroAnalyzer {
    constructor(options?: KuromojiAnalyzerOptions);
    parse(text: string): Promise<unknown>;
  }

  export = KuromojiAnalyzer;
}
