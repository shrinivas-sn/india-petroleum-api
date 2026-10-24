/**
 * Thin JSON client for this API. A non-success answer becomes an ApiError that carries the
 * envelope's code and message, so a page can show exactly what the server said.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'ERROR', details = null, retryAfterSeconds = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function apiGet(path, { signal } = {}) {
  const started = performance.now();
  let response;
  try {
    response = await fetch(path, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Could not reach the API. Check your connection and try again.', { code: 'NETWORK_ERROR' });
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: handled below as a failure.
  }
  const ms = Math.round(performance.now() - started);

  if (!response.ok || !body || body.success !== true) {
    const detail = body?.error;
    const retry = Number(response.headers.get('retry-after'));
    throw new ApiError(detail?.message ?? `The API answered ${response.status} without a JSON error.`, {
      status: response.status,
      code: detail?.code ?? 'ERROR',
      details: detail ?? null,
      retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : null,
    });
  }
  return { body, status: response.status, ms };
}

/** Builds /v1/prices?... from the playground's fields; empty values are left out. */
export function pricesPath({ city, fuel, from, to }) {
  const query = new URLSearchParams();
  if (city) query.set('city', city);
  if (fuel) query.set('fuel', fuel);
  query.set('from', from);
  query.set('to', to);
  return `/v1/prices?${query.toString()}`;
}
