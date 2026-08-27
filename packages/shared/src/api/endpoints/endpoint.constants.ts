export enum HttpStatusCode {
  OK = 200,
  BAD_REQUEST = 400,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

export enum ErrorCode {
  /** The query failed standard validation */
  INVALID_QUERY = 'INVALID_QUERY',
  /** The query string was empty */
  NO_QUERY = 'NO_QUERY',
  /** One or more requested equipment names don't exist */
  UNKNOWN_EQUIPMENT = 'UNKNOWN_EQUIPMENT',
  /** The requested junk name doesn't exist */
  UNKNOWN_JUNK = 'UNKNOWN_JUNK',
  /** One or more requested blessing codes don't exist */
  UNKNOWN_BLESSING = 'UNKNOWN_BLESSING',
  /** One or more requested equipment category codes don't exist */
  UNKNOWN_CATEGORY = 'UNKNOWN_CATEGORY',
  /** One or more requested rank kinds don't exist */
  UNKNOWN_RANK = 'UNKNOWN_RANK',
  /**
   * The described piece isn't one the game can produce — a gap between filled
   * blessing slots, a slot left empty past its own milestone, or a grade at drop
   * that disagrees with how many slots hold a blessing. See
   * `checkBlessingSlotState` in `@shared/domain/blessingSlots`.
   */
  INVALID_SLOT_STATE = 'INVALID_SLOT_STATE',
  /**
   * A refinement was planned for a slot that already carries one. A new stone
   * replaces the old, so answering needs the existing refinement subtracted out
   * first — not yet supported (see docs/calculation/enhancement.md).
   */
  ALREADY_REFINED = 'ALREADY_REFINED',
  /** An unexpected server-side error */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
