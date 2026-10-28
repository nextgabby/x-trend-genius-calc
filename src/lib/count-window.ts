/**
 * Resolve a post-counts time window before it is sent to X.
 *
 * GET /2/tweets/counts/all (full archive — not the 7-day recent endpoint) rejects:
 * - end_time newer than ~10 seconds before the request
 * - start_time that is not strictly before end_time
 *
 * Callers send the user's requested range. This module clamps or substitutes
 * a window that satisfies those rules, or refuses the range.
 */

/** X rejects an end_time inside this lag. The guard uses this value. */
export const X_COUNTS_MIN_END_LAG_MS = 10_000;

/**
 * Margin actually used when clamping. Wider than the API's 10-second minimum
 * so a small clock skew still produces an acceptable end_time. Same 1-minute
 * margin the counts route used before this check existed.
 */
export const X_COUNTS_END_LAG_MS = 60_000;

/** Proxy window when the campaign has not produced a queryable range yet. */
export const RECENT_PROXY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type CountWindowKind = 'requested' | 'clamped' | 'recent-proxy';

export interface CountWindowInfo {
  kind: CountWindowKind;
  /** Range that will be sent to X. startTime < endTime, endTime <= now - 1 minute. */
  startTime: string;
  endTime: string;
  requestedStartTime: string;
  requestedEndTime: string;
  /** User-facing explanation when the fetched window differs from the request. */
  notice: string | null;
}

export type ResolveCountWindowResult =
  | { ok: true; window: CountWindowInfo }
  | { ok: false; error: string };

const UTC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatUtc(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${UTC_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} ${hh}:${mm} UTC`;
}

function parseInstant(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Campaign Setup date inputs are `YYYY-MM-DD`. Threshold Analysis treats the
 * start as UTC midnight and the end as 23:59:59Z on that calendar day.
 */
export function thresholdCampaignRange(
  startDate: string,
  endDate: string
): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return null;
  }
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start: start.toISOString(), end: end.toISOString() };
}

export function assertValidCountsRange(
  startTime: string,
  endTime: string,
  now: Date = new Date()
): void {
  const start = parseInstant(startTime);
  const end = parseInstant(endTime);
  if (!start || !end) {
    throw new Error('Refusing to call X counts: start_time or end_time is not a valid time.');
  }
  if (start.getTime() >= end.getTime()) {
    throw new Error(
      `Refusing to call X counts: start_time (${startTime}) must be before end_time (${endTime}).`
    );
  }
  if (end.getTime() > now.getTime() - X_COUNTS_MIN_END_LAG_MS) {
    throw new Error(
      `Refusing to call X counts: end_time (${endTime}) must be at least 10 seconds before now.`
    );
  }
}

export function resolveCountWindow(input: {
  start: string;
  end: string;
  now?: Date;
  /**
   * Threshold Analysis sets this. When the campaign has not started, return
   * the last 7 days instead of failing. The wizard leaves it off so a bad
   * future lookback is rejected rather than silently replaced.
   */
  recentProxyWhenUnstarted?: boolean;
}): ResolveCountWindowResult {
  const now = input.now ?? new Date();
  const requestedStart = parseInstant(input.start);
  const requestedEnd = parseInstant(input.end);

  if (!requestedStart || !requestedEnd) {
    return { ok: false, error: 'Could not read the start or end date.' };
  }

  if (requestedStart.getTime() >= requestedEnd.getTime()) {
    return { ok: false, error: 'Start date must be before end date.' };
  }

  const safeMax = new Date(now.getTime() - X_COUNTS_END_LAG_MS);
  let start = requestedStart;
  let end = requestedEnd;
  let kind: CountWindowKind = 'requested';

  if (end.getTime() > safeMax.getTime()) {
    end = safeMax;
    kind = 'clamped';
  }

  // Clamping a wholly future campaign puts the start after the end.
  // That is the range X rejects. Do not send it.
  if (start.getTime() >= end.getTime()) {
    if (!input.recentProxyWhenUnstarted) {
      return {
        ok: false,
        error:
          'These dates are still in the future, so there is no post volume to fetch. Choose a start date that is already in the past.',
      };
    }

    end = safeMax;
    start = new Date(end.getTime() - RECENT_PROXY_WINDOW_MS);
    kind = 'recent-proxy';
  }

  const startTime = start.toISOString();
  const endTime = end.toISOString();
  assertValidCountsRange(startTime, endTime, now);

  const requestedStartTime = requestedStart.toISOString();
  const requestedEndTime = requestedEnd.toISOString();

  let notice: string | null = null;
  if (kind === 'recent-proxy') {
    notice =
      `X cannot return posts for this date range yet because it starts after the latest time the counts API will accept. ` +
      `Showing the last 7 days (${formatUtc(start)} – ${formatUtc(end)}) as a proxy. ` +
      `The campaign period itself is not in this chart.`;
  } else if (kind === 'clamped' && requestedEnd.getTime() > now.getTime()) {
    notice =
      `The campaign end is still in the future. Volume runs from ${formatUtc(start)} through ${formatUtc(end)}, ` +
      `which is the latest time X will return. This includes only the part of the campaign that has already happened.`;
  }

  return {
    ok: true,
    window: {
      kind,
      startTime,
      endTime,
      requestedStartTime,
      requestedEndTime,
      notice,
    },
  };
}
