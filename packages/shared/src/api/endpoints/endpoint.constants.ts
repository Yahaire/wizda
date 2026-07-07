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
  /** An unexpected server-side error */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
