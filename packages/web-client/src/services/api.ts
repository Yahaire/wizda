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
import type { PopularResult } from '@shared/api/endpoints/popular.models';

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

// Notified whenever any request discovers maintenance mode (HTTP 503), so a
// single global gate (MaintenanceGate) can react without every caller wiring
// its own MaintenanceError handling. Callers that still want the throw (e.g.
// to bail out of a local loading state) get it too — the two aren't exclusive.
const maintenanceListeners = new Set<(message: string) => void>();

export function subscribeMaintenance(callback: (message: string) => void): () => void {
  maintenanceListeners.add(callback);
  return () => maintenanceListeners.delete(callback);
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
    for (const listener of maintenanceListeners) {
      listener(body.message);
    }
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

  // Concurrent callers requesting the same GET path share one in-flight
  // request instead of each firing their own (e.g. MaintenanceGate and
  // DataFreshness both probing `/data-status` on mount). Cleared as soon as the
  // request settles — not cached beyond that — so callers that poll over time
  // (MaintenanceGate's recovery check) still hit the network on every call.
  private readonly inflight = new Map<string, Promise<unknown>>();

  private get<T>(path: string): Promise<T> {
    const pending = this.inflight.get(path);
    if (pending) {
      return pending as Promise<T>;
    }
    const request = this.fetchJson<T>(path).finally(() => {
      this.inflight.delete(path);
    });
    this.inflight.set(path, request);
    return request;
  }

  private async fetchJson<T>(path: string): Promise<T> {
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

  popular(): Promise<PopularResult> {
    return this.get<PopularResult>('/popular');
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
