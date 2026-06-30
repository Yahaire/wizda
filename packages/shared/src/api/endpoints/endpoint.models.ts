export interface RequestErrorInfo {
  errorCode: string,
  message: string,
}

export interface MaintenanceResponse {
  maintenance: true,
  message: string,
}

// Domain response/request models go here as the API takes shape, e.g. the
// "how much junk to guarantee item X" calculation result.
