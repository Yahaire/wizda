export abstract class TsUtilities {
  /**
   * Iterates over a numeric enum and returns an array of transformed values.
   * @param enumObj The Enum object to iterate over.
   * @param callback A function that receives the key and value.
   * @returns An array of the return type of the callback.
   */
  static mapNumericEnum<T extends object, R>(
    enumObj: T,
    callback: (key: string, value: T[keyof T]) => R
  ): R[] {
    return Object
        .keys(enumObj)
        .filter((key) => isNaN(Number(key))) // Remove numeric keys (reverse mapping)
        .map((key) => {
          const value = enumObj[key as keyof T];
          return callback(key, value);
        })
        ;
  }

  static forEachNumericEnum<T extends object>(
    enumObj: T,
    callback: (key: string, value: T[keyof T]) => void
  ): void {
    TsUtilities.mapNumericEnum(enumObj, callback);
  }

  /**
   * Joins string fragments into one string. Lets a multi-line message be
   * written as one-fragment-per-line array (clean diffs) instead of `+` glue.
   * @param parts The fragments to join.
   * @param separator What to place between fragments. Defaults to a single space.
   * @returns The joined string.
   */
  static stringJoin(parts: string[], separator: string = " "): string {
    return parts.join(separator);
  }
}