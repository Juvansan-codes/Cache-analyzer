import { CacheConfig, TracePattern } from '../types';

const API_BASE = '/api';

async function apiRequest(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, options);

  if (!res.ok) {
    let details = '';
    try {
      const data = await res.json();
      if (data?.detail) {
        details = `: ${data.detail}`;
      }
    } catch {
      // ignore parse errors and keep status-based message
    }

    throw new Error(`API request failed (${res.status} ${res.statusText})${details}`);
  }

  return res;
}

export async function createSession(config: CacheConfig): Promise<string> {
  const res = await apiRequest('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  const data = await res.json();
  return data.session_id;
}

export async function runTrace(
  sessionId: string,
  pattern: TracePattern,
  count: number,
  addressBits: number
): Promise<void> {
  await apiRequest(`/session/${sessionId}/trace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pattern,
      count,
      address_range: Math.pow(2, addressBits),
    }),
  });
}

export async function startSerial(sessionId: string): Promise<void> {
  await apiRequest(`/session/${sessionId}/serial/start`, {
    method: 'POST',
  });
}

export async function stopSerial(sessionId: string): Promise<void> {
  await apiRequest(`/session/${sessionId}/serial/stop`, {
    method: 'POST',
  });
}

export async function resetSession(sessionId: string): Promise<void> {
  await apiRequest(`/session/${sessionId}/reset`, {
    method: 'POST',
  });
}

export function getExportUrl(sessionId: string): string {
  return `${API_BASE}/export/${sessionId}`;
}
