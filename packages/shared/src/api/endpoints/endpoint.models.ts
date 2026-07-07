export interface RequestErrorInfo {
  errorCode: string,
  message: string,
}

export interface MaintenanceResponse {
  maintenance: true,
  message: string,
}

// Generic infra models live here. Domain response/request models live in
// sibling files, e.g. the guarantee endpoints in ./junkToGuarantee.models.ts.
