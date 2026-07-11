import type {
  DataStatusResponse,
  MaintenanceResponse,
  RequestErrorInfo,
} from '@shared/api/endpoints/endpoint.models';
import type {
  CertaintyCurveQuery,
  CertaintyCurveResult,
  JunkToGuaranteeQuery,
  JunkToGuaranteeResult,
} from '@shared/api/endpoints/junkToGuarantee.models';
import type {
  EquipmentListItem,
  JunkListItem,
} from '@shared/api/endpoints/lists.models';

/** Thrown when the API is in maintenance mode (HTTP 503 + `{ maintenance: true }`). */
export class MaintenanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaintenanceError';
  }
}

/**
 * Thrown for a typed 4xx/5xx error body (`RequestErrorInfo`). Carries the
 * machine-readable `errorCode` so the UI can pick Wizda-voiced wording.
 */
export class ApiError extends Error {
  readonly errorCode: string;
  readonly status: number;

  constructor(errorCode: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.errorCode = errorCode;
    this.status = status;
  }
}

async function checkForMaintenance(response: Response): Promise<void> {
  if (response.status !== 503) {
    return;
  }

  let body: MaintenanceResponse | undefined;
  try {
    body = await response.clone().json();
  } catch { /* ignore parse error */ }

  if (body?.maintenance === true) {
    throw new MaintenanceError(body.message);
  }
}

async function throwForError(response: Response): Promise<never> {
  let info: RequestErrorInfo | undefined;
  try {
    info = await response.clone().json();
  } catch { /* non-JSON body */ }

  throw new ApiError(
    info?.errorCode ?? 'INTERNAL_ERROR',
    info?.message ?? response.statusText,
    response.status,
  );
}

class ApiService {
  // Same-origin; Next rewrites `/api/*` to the backend (dodges CORS).
  private readonly baseUrl = '/api';

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    await checkForMaintenance(response);
    if (!response.ok) {
      await throwForError(response);
    }
    return response.json();
  }

  private async post<TBody, TResult>(path: string, body: TBody): Promise<TResult> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await checkForMaintenance(response);
    if (!response.ok) {
      await throwForError(response);
    }
    return response.json();
  }

  dataStatus(): Promise<DataStatusResponse> {
    return this.get<DataStatusResponse>('/data-status');
  }

  listJunks(): Promise<JunkListItem[]> {
    return this.get<JunkListItem[]>('/junks');
  }

  listEquipment(): Promise<EquipmentListItem[]> {
    return this.get<EquipmentListItem[]>('/equipment');
  }

  junkToGuarantee(query: JunkToGuaranteeQuery): Promise<JunkToGuaranteeResult> {
    return this.post<JunkToGuaranteeQuery, JunkToGuaranteeResult>(
      '/junk-to-guarantee',
      query,
    );
  }

  certaintyCurve(query: CertaintyCurveQuery): Promise<CertaintyCurveResult> {
    return this.post<CertaintyCurveQuery, CertaintyCurveResult>(
      '/junk-to-guarantee/curve',
      query,
    );
  }
}

export const api = new ApiService();
