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
}