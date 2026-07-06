/** One row of "Additional Blessing Drop Rates by Equipment": rate is always > 0 — zero rates aren't emitted. */
export interface ParsedEquipmentBlessingDropRateRow {
  equipmentName: string;
  /** Blessing slot, 1-4. */
  slot: number;
  blessingCode: string;
  /** P(this blessing lands in this slot | equipment), as a fraction in (0, 1]. */
  rate: number;
}
