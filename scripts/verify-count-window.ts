/**
 * Date-window checks for X post counts.
 * Run: node --experimental-strip-types scripts/verify-count-window.ts
 *
 * Reproduces the pre-fix clamp (end pulled to now-1m with no start check)
 * and asserts the resolver never emits a range X would reject.
 */
import {
  assertValidCountsRange,
  resolveCountWindow,
  thresholdCampaignRange,
  X_COUNTS_END_LAG_MS,
  RECENT_PROXY_WINDOW_MS,
} from '../src/lib/count-window.ts';

const NOW = new Date('2026-10-28T19:26:00.000Z');

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

let passed = 0;
function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
  passed++;
}

/** The clamp /api/fetch-counts used before this fix. */
function legacyClamp(start: string, end: string, now: Date) {
  const startTime = new Date(start).toISOString();
  const requestedEnd = new Date(end);
  const safeMax = new Date(now.getTime() - 60_000);
  const endTime = requestedEnd > safeMax ? safeMax.toISOString() : requestedEnd.toISOString();
  return {
    startTime,
    endTime,
    inverted: new Date(startTime).getTime() >= new Date(endTime).getTime(),
  };
}

function campaign(startDate: string, endDate: string) {
  const range = thresholdCampaignRange(startDate, endDate);
  assert(range, `could not parse ${startDate} → ${endDate}`);
  return range;
}

console.log('\n=== Legacy clamp (the bug) ===\n');

const futureRange = campaign('2026-11-01', '2026-11-30');
const legacyFuture = legacyClamp(futureRange.start, futureRange.end, NOW);
console.log('  fully future sent to X:', legacyFuture);
assert(legacyFuture.inverted, 'legacy clamp must invert a fully future campaign (start after end)');
ok('fully future: legacy clamp sets start after end');

let legacyThrew = false;
try {
  assertValidCountsRange(legacyFuture.startTime, legacyFuture.endTime, NOW);
} catch {
  legacyThrew = true;
}
assert(legacyThrew, 'guard must refuse the inverted legacy range');
ok('fully future: counts guard refuses the inverted range');

const partialRange = campaign('2026-10-21', '2026-11-15');
const legacyPartial = legacyClamp(partialRange.start, partialRange.end, NOW);
assert(!legacyPartial.inverted, 'legacy partial-future clamp stays ordered');
assert(legacyPartial.endTime === new Date(NOW.getTime() - 60_000).toISOString(), 'legacy partial end is now-1m');
ok('partial future: legacy clamp keeps start < end and moves the end to now-1m');

const pastRange = campaign('2026-10-01', '2026-10-14');
const legacyPast = legacyClamp(pastRange.start, pastRange.end, NOW);
assert(!legacyPast.inverted, 'legacy past range stays ordered');
assert(legacyPast.startTime === pastRange.start && legacyPast.endTime === pastRange.end, 'legacy past range is unchanged');
ok('past range: legacy clamp leaves both ends alone');

console.log('\n=== Resolver ===\n');

const future = resolveCountWindow({
  start: futureRange.start,
  end: futureRange.end,
  now: NOW,
  recentProxyWhenUnstarted: true,
});
assert(future.ok, 'future campaign with proxy flag should resolve');
if (future.ok) {
  assert(future.window.kind === 'recent-proxy', `expected recent-proxy, got ${future.window.kind}`);
  const endMs = new Date(future.window.endTime).getTime();
  const startMs = new Date(future.window.startTime).getTime();
  assert(endMs === NOW.getTime() - X_COUNTS_END_LAG_MS, 'proxy ends one minute before now');
  assert(endMs - startMs === RECENT_PROXY_WINDOW_MS, 'proxy is exactly 7 days');
  assert(startMs < endMs, 'proxy start is before end');
  assert(future.window.notice?.includes('last 7 days'), 'proxy notice names the 7-day window');
  assert(future.window.notice?.includes('proxy'), 'proxy notice says it is a proxy');
  assert(future.window.notice?.includes('campaign period itself is not'), 'proxy notice says the chart is not the campaign period');
  assertValidCountsRange(future.window.startTime, future.window.endTime, NOW);
  ok(`fully future → proxy ${future.window.startTime} → ${future.window.endTime}`);
}

const futureNoProxy = resolveCountWindow({
  start: futureRange.start,
  end: futureRange.end,
  now: NOW,
});
assert(!futureNoProxy.ok, 'wizard path must reject an all-future range');
if (!futureNoProxy.ok) {
  assert(/future/i.test(futureNoProxy.error), `error should mention the future: ${futureNoProxy.error}`);
  ok('fully future without proxy flag →  rejected, no range to send');
}

const partial = resolveCountWindow({
  start: partialRange.start,
  end: partialRange.end,
  now: NOW,
  recentProxyWhenUnstarted: true,
});
assert(partial.ok, 'partial future should resolve');
if (partial.ok) {
  assert(partial.window.kind === 'clamped', `expected clamped, got ${partial.window.kind}`);
  assert(partial.window.startTime === partialRange.start, 'partial start is unchanged');
  assert(
    partial.window.endTime === new Date(NOW.getTime() - X_COUNTS_END_LAG_MS).toISOString(),
    'partial end is now-1m'
  );
  assert(new Date(partial.window.startTime) < new Date(partial.window.endTime), 'partial start < end');
  assert(partial.window.notice?.includes('still in the future'), 'partial notice explains the future end');
  assert(partial.window.notice?.includes('already happened'), 'partial notice says only elapsed campaign time');
  assertValidCountsRange(partial.window.startTime, partial.window.endTime, NOW);
  ok(`partial future → clamped ${partial.window.startTime} → ${partial.window.endTime}`);
}

const past = resolveCountWindow({
  start: pastRange.start,
  end: pastRange.end,
  now: NOW,
  recentProxyWhenUnstarted: true,
});
assert(past.ok, 'past range should resolve');
if (past.ok) {
  assert(past.window.kind === 'requested', `expected requested, got ${past.window.kind}`);
  assert(past.window.startTime === pastRange.start, 'past start unchanged');
  assert(past.window.endTime === pastRange.end, 'past end unchanged');
  assert(past.window.notice === null, 'past range has no notice');
  assertValidCountsRange(past.window.startTime, past.window.endTime, NOW);
  ok(`past range unchanged ${past.window.startTime} → ${past.window.endTime}`);
}

const swapped = resolveCountWindow({
  start: campaign('2026-10-14', '2026-10-01').start,
  end: campaign('2026-10-14', '2026-10-01').end,
  now: NOW,
  recentProxyWhenUnstarted: true,
});
assert(!swapped.ok, 'start after end must be rejected even when the proxy flag is on');
if (!swapped.ok) {
  assert(/before end/i.test(swapped.error), `swapped-date error: ${swapped.error}`);
  ok('start after end → rejected, proxy not used');
}

const startsToday = resolveCountWindow({
  ...campaign('2026-10-28', '2026-12-01'),
  now: NOW,
  recentProxyWhenUnstarted: true,
});
assert(startsToday.ok && startsToday.window.kind === 'clamped', 'a campaign that started earlier today is clamped, not proxied');
if (startsToday.ok) {
  assert(startsToday.window.startTime === '2026-10-28T00:00:00.000Z', 'today start is kept');
  assert(new Date(startsToday.window.startTime) < new Date(startsToday.window.endTime), 'today start is still before the clamped end');
  ok('start today, end in the future → clamp, do not proxy');
}

const endsToday = resolveCountWindow({
  ...campaign('2026-10-20', '2026-10-28'),
  now: NOW,
  recentProxyWhenUnstarted: true,
});
assert(endsToday.ok && endsToday.window.kind === 'clamped', 'campaign ending today is clamped, not proxied');
if (endsToday.ok) {
  assert(endsToday.window.startTime === campaign('2026-10-20', '2026-10-28').start, 'today-end keeps the start');
  assertValidCountsRange(endsToday.window.startTime, endsToday.window.endTime, NOW);
  ok('end date today → clamp end, keep start');
}

const withinLag = resolveCountWindow({
  start: '2026-10-01T00:00:00.000Z',
  end: new Date(NOW.getTime() - 30_000).toISOString(),
  now: NOW,
});
assert(withinLag.ok && withinLag.window.kind === 'clamped', 'end inside the safety lag is clamped');
if (withinLag.ok) {
  assert(withinLag.window.notice === null, 'a past end that is only inside the 1-minute lag has no banner');
  assert(
    withinLag.window.endTime === new Date(NOW.getTime() - X_COUNTS_END_LAG_MS).toISOString(),
    'lag clamp lands on now-1m'
  );
  ok('end 30s ago → silent clamp to now-1m');
}

const unreadable = resolveCountWindow({ start: 'nope', end: 'also-nope', now: NOW });
assert(!unreadable.ok, 'unreadable dates are rejected');
ok('unreadable dates → rejected');

const tooRecentEnd = new Date(NOW.getTime() - 5_000).toISOString();
let endGuardThrew = false;
try {
  assertValidCountsRange('2026-10-01T00:00:00.000Z', tooRecentEnd, NOW);
} catch (err) {
  endGuardThrew = true;
  assert(err instanceof Error && /10 seconds/.test(err.message), `end guard message: ${err}`);
}
assert(endGuardThrew, 'end_time within 10 seconds of now must throw');
ok('end_time 5s ago → guard throws');

console.log(`\n${passed} checks passed\n`);
