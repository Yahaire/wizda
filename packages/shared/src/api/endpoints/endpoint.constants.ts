export enum HttpStatusCode {
  OK = 200,
  BAD_REQUEST = 400,
  NOT_FOUND = 404,
}

export enum ErrorCode {
  /** The query failed standard validation */
  INVALID_QUERY = 'INVALID_QUERY',
  /** The query string was empty */
  NO_QUERY = 'NO_QUERY',
}
