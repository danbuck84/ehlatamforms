import type {
  CheckinError,
  CheckinRequest,
  CheckinSuccess,
  SessionsCurrentResponse,
} from '../../shared/schemas';
import { getAppCheckToken } from './app-check';

export class ApiError extends Error {
  readonly status: number;
  readonly data: CheckinError;
  constructor(status: number, data: CheckinError) {
    super(data.error);
    this.status = status;
    this.data = data;
  }
}

export async function fetchCurrentSessions(): Promise<{
  data: SessionsCurrentResponse;
  clockOffsetMs: number;
}> {
  const res = await fetch('/api/sessions/current', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`sessions_current_${res.status}`);
  }
  const data = (await res.json()) as SessionsCurrentResponse;
  const serverMs = Date.parse(data.serverNow);
  const clockOffsetMs = Number.isFinite(serverMs) ? serverMs - Date.now() : 0;
  return { data, clockOffsetMs };
}

export async function buildCheckinHeaders(): Promise<Record<string, string>> {
  const token = await getAppCheckToken();
  return token ? { 'X-Firebase-AppCheck': token } : {};
}

export async function submitCheckin(payload: CheckinRequest): Promise<CheckinSuccess> {
  const headers = await buildCheckinHeaders();
  const res = await fetch('/api/checkin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({ error: 'server' }))) as CheckinSuccess | CheckinError;
  if (!res.ok) {
    throw new ApiError(res.status, 'error' in body ? body : { error: 'server' });
  }
  return body as CheckinSuccess;
}
