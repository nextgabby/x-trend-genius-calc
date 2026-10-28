/**
 * Verification script for exact-keywords query syntax vs Grok-optimize assembleQuery.
 * Run: node --experimental-strip-types scripts/verify-exact-query-syntax.ts
 */
import { normalizeExactQuery, ensureXQuerySyntax, assembleQuery } from '../src/lib/query-syntax.ts';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/** Simulate route suggestedQuery assembly */
function simulateRouteSuggestedQuery(opts: {
  useExactKeywords: boolean;
  rawKeywordInput?: string;
  keywords: string[];
  keywordOperator?: 'AND' | 'OR' | 'SINGLE';
  queryTerms?: string[];
}): string {
  if (opts.useExactKeywords) {
    const exactSource =
      opts.rawKeywordInput?.trim() ||
      opts.keywords.join(opts.keywordOperator === 'AND' ? ' AND ' : ' OR ');
    return normalizeExactQuery(exactSource);
  }
  return assembleQuery(opts.queryTerms || opts.keywords);
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function assertNoBareAnd(query: string, label: string) {
  // Bare AND as operator (not inside quotes)
  const withoutQuotes = query.replace(/"[^"]*"/g, '""');
  assert(!/\bAND\b/.test(withoutQuotes), `${label}: must not contain bare AND — got: ${query}`);
}

let passed = 0;
function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
  passed++;
}

console.log('\n=== Exact keywords normalization ===\n');

const nbaInput = `Shai Gilgeous-Alexander OR Nikola Jokic OR Luka Doncic OR Anthony Edwards OR Victor Wembanyama OR LeBron James OR Jayson Tatum OR Giannis Antetokounmpo OR Cade Cunningham OR Jalen Brunson OR Karl-Anthony Towns OR Tyrese Maxey OR Devin Booker OR Joel Embiid OR Stephen Curry
AND
(points OR rebounds OR assists OR PRA OR triple double OR career high OR injury OR starting lineup OR minutes OR usage)`;

const nba = normalizeExactQuery(nbaInput);
console.log('NBA exact output:\n ', nba, '\n');

assertNoBareAnd(nba, 'NBA query');
ok('no bare AND operator');

assert(nba.includes('(') && nba.includes(')'), 'NBA query has parentheses');
ok('has parentheses for grouping');

assert(
  nba.includes('"Shai Gilgeous-Alexander"') && nba.includes('"LeBron James"') && nba.includes('"Stephen Curry"'),
  'player names quoted'
);
ok('multi-word player names quoted');

assert(nba.includes('"triple double"') && nba.includes('"career high"') && nba.includes('"starting lineup"'), 'stats phrases quoted');
ok('multi-word stats phrases quoted');

assert(/\bpoints\b/.test(nba) && /\bPRA\b/.test(nba) && /\busage\b/.test(nba), 'single-word stats kept');
ok('single-word stats unchanged');

// Must be two AND-joined groups (space), NOT a flat OR of players and stats
assert(
  /\)\s*\(/.test(nba) || /\).*\(points/.test(nba),
  'players group AND stats group (space between paren groups)'
);
ok('AND intent preserved as space between groups');

// Critical regression: must NOT flatten to all ORs
const flatBug =
  '"Shai Gilgeous-Alexander" OR "Nikola Jokic" OR "Luka Doncic" OR "Anthony Edwards" OR "Victor Wembanyama" OR "LeBron James" OR "Jayson Tatum" OR "Giannis Antetokounmpo" OR "Cade Cunningham" OR "Jalen Brunson" OR "Karl-Anthony Towns" OR "Tyrese Maxey" OR "Devin Booker" OR "Joel Embiid" OR "Stephen Curry" OR points OR rebounds OR assists OR PRA OR "triple double" OR "career high" OR injury OR "starting lineup" OR minutes OR usage';
assert(nba !== flatBug, 'must not equal the old flat-OR bug output');
assert(!/Curry"\s+OR\s+points/.test(nba), 'must not OR players directly into stats');
ok('does not flatten to all-OR (regression)');

const expectedNba =
  '("Shai Gilgeous-Alexander" OR "Nikola Jokic" OR "Luka Doncic" OR "Anthony Edwards" OR "Victor Wembanyama" OR "LeBron James" OR "Jayson Tatum" OR "Giannis Antetokounmpo" OR "Cade Cunningham" OR "Jalen Brunson" OR "Karl-Anthony Towns" OR "Tyrese Maxey" OR "Devin Booker" OR "Joel Embiid" OR "Stephen Curry") (points OR rebounds OR assists OR PRA OR "triple double" OR "career high" OR injury OR "starting lineup" OR minutes OR usage)';
assert(nba === expectedNba, `exact NBA match\n  expected: ${expectedNba}\n  got:      ${nba}`);
ok('matches expected X-valid query');

console.log('\n=== Other exact-mode cases ===\n');

const team = normalizeExactQuery('Team Canada AND World Cup');
assert(team === '("Team Canada") ("World Cup")', `got ${team}`);
assertNoBareAnd(team, 'Team Canada');
ok('Team Canada AND World Cup → parenthesized space-AND');

const orOnly = normalizeExactQuery('NFL OR NBA');
assert(orOnly === '(NFL OR NBA)' || orOnly === 'NFL OR NBA', `got ${orOnly}`);
ok(`simple OR works: ${orOnly}`);

const alreadyQuoted = normalizeExactQuery('"already quoted" OR simple');
assert(alreadyQuoted.includes('"already quoted"'), 'keeps existing quotes');
ok('preserves already-quoted phrases');

const withNeg = normalizeExactQuery('Nike AND Jordan -scandal');
assert(withNeg === '(Nike) (Jordan) -scandal', `AND + negation: ${withNeg}`);
assertNoBareAnd(withNeg, 'Nike AND Jordan');
ok(`AND + negation with parens: ${withNeg}`);

console.log('\n=== Comma → OR (strategist paste format) ===\n');

const commaList = normalizeExactQuery('#RollTide, #WarEagle, Auburn, "Arch Manning", "Texas A&M"');
assert(!commaList.includes(','), `no commas remain: ${commaList}`);
assert(
  commaList === '(#RollTide OR #WarEagle OR Auburn OR "Arch Manning" OR "Texas A&M")',
  `got ${commaList}`
);
ok('comma-separated list → OR chain with quotes preserved');

const commaAnd = normalizeExactQuery('#RollTide, Bama AND (Heisman OR "National Championship")');
assert(
  commaAnd === '(#RollTide OR Bama) (Heisman OR "National Championship")',
  `got ${commaAnd}`
);
ok('commas + AND → OR group space-ANDed with second group');

const ensureComma = ensureXQuerySyntax('#SEC, #BigTen, "Ohio State"');
assert(!ensureComma.includes(','), 'ensureXQuerySyntax strips commas');
assert(ensureComma.includes(' OR '), 'ensureXQuerySyntax converts commas to OR');
ok('ensureXQuerySyntax fixes commas on approve');

console.log('\n=== ensureXQuerySyntax (exact approve path only) ===\n');

const ensureOut = ensureXQuerySyntax(
  '"Shai Gilgeous-Alexander" OR "Nikola Jokic" AND (points OR rebounds)'
);
assertNoBareAnd(ensureOut, 'ensureXQuerySyntax');
assert(ensureOut === '("Shai Gilgeous-Alexander" OR "Nikola Jokic") (points OR rebounds)', `got ${ensureOut}`);
ok('fixes bare AND with parenthesized groups on approve');

const untouched = ensureXQuerySyntax('CanMNT OR #CanadaSoccer OR "Canada National Team"');
assert(
  untouched === '(CanMNT OR #CanadaSoccer OR "Canada National Team")',
  `OR-only still normalized/parenthesized: ${untouched}`
);
ok('OR-only queries get valid X grouping on exact normalize');

console.log('\n=== Route branching: exact vs Grok optimize ===\n');

const exactRoute = simulateRouteSuggestedQuery({
  useExactKeywords: true,
  rawKeywordInput: nbaInput,
  keywords: ['players…', '(stats…)'],
  keywordOperator: 'AND',
});
assert(exactRoute === expectedNba, 'exact route uses normalizeExactQuery');
ok('exact mode route → normalizeExactQuery');

const grokTerms = ['Canada National Team', 'CanMNT', '#CanadaSoccer', 'Canada vs Switzerland', '-scandal'];
const grokRoute = simulateRouteSuggestedQuery({
  useExactKeywords: false,
  keywords: ['Team Canada'],
  queryTerms: grokTerms,
});
const grokBefore = '"Canada National Team" OR CanMNT OR #CanadaSoccer OR "Canada vs Switzerland" -scandal';
const grokExpected = '("Canada National Team" OR CanMNT OR #CanadaSoccer OR "Canada vs Switzerland") -scandal';
assert(grokRoute === grokExpected, `got ${grokRoute}`);
assert(grokRoute === assembleQuery(grokTerms), 'optimize uses assembleQuery');
assert(grokRoute !== grokBefore, 'must not leave exclusions bound only to the last OR term');
ok('Grok optimize route → assembleQuery groups OR terms before exclusions');

console.log('\n=== Grok-optimize grouping: exclusions apply to every keyword ===\n');
console.log('  before:', grokBefore);
console.log('  after: ', grokExpected);

// Same builder is used for the lookback query (year/opponent-swapped terms).
const lookbackTerms = ['Canada vs Belgium', 'CanMNT', '#WC2022', '-scandal', '-bet'];
const lookback = assembleQuery(lookbackTerms);
assert(
  lookback === '("Canada vs Belgium" OR CanMNT OR #WC2022) -scandal -bet',
  `lookback got ${lookback}`
);
ok(`lookback query grouped: ${lookback}`);

const campaignMatchup = assembleQuery(['Canada vs Switzerland', 'CanMNT', '#WC2026', '-scandal', '-bet']);
assert(
  campaignMatchup === '("Canada vs Switzerland" OR CanMNT OR #WC2026) -scandal -bet',
  `campaign got ${campaignMatchup}`
);
// Exact mode already parenthesizes this shape; optimize now matches it.
assert(
  campaignMatchup === normalizeExactQuery('Canada vs Switzerland OR CanMNT OR #WC2026 -scandal -bet'),
  'optimize OR+exclusion matches exact-mode grouping'
);
ok('campaign query grouped the same way exact mode already does');

assert(assembleQuery(['NFL', 'NBA', '-lang:ja']) === '(NFL OR NBA) -lang:ja', 'operator exclusion');
ok('other trailing operators (for example -lang:) apply to the whole OR group');

assert(assembleQuery(['A', 'B', '-"domestic violence"', '-injury']) === '(A OR B) -"domestic violence" -injury');
ok('multi-word and already-quoted exclusions stay outside the group');

assert(assembleQuery(['a', '-x', 'b', '-y']) === '(a OR b) -x -y', 'interleaved terms');
ok('exclusions are pulled out of the OR list and applied to every keyword');

// Single keyword and no-exclusion cases: valid, no empty parentheses.
assert(assembleQuery(['Nike']) === 'Nike');
assert(assembleQuery(['Nike', '-scandal']) === 'Nike -scandal');
assert(assembleQuery(['Team Canada', '-point spread']) === '"Team Canada" -"point spread"');
assert(assembleQuery(['NFL', 'NBA']) === 'NFL OR NBA');
assert(assembleQuery(['Canada National Team', 'CanMNT']) === '"Canada National Team" OR CanMNT');
assert(assembleQuery([]) === '');
assert(assembleQuery(['-scandal', '-lawsuit']) === '-scandal -lawsuit');
assert(assembleQuery(['  NFL  ', ' NBA ', ' -scandal ']) === '(NFL OR NBA) -scandal');
assert(assembleQuery(['NFL', ' NFL ', 'NBA', '-bet', '-bet']) === '(NFL OR NBA) -bet');
for (const q of [
  assembleQuery([]),
  assembleQuery(['Nike']),
  assembleQuery(['Nike', '-scandal']),
  assembleQuery(['NFL', 'NBA']),
  assembleQuery(['-scandal']),
  assembleQuery(['A', 'B', '-x']),
]) {
  assert(!q.includes('()'), `stray empty parens in ${JSON.stringify(q)}`);
}
ok('single-keyword, no-exclusion, and empty cases have no stray parentheses');

// Grouping adds one pair of parentheses. It does not copy each exclusion
// onto every keyword, which would multiply length toward X's query cap.
const manyTerms = Array.from({ length: 30 }, (_, i) => `term${i}`);
const manyNeg = ['-alpha', '-beta', '-gamma'];
const groupedMany = assembleQuery([...manyTerms, ...manyNeg]);
const ungroupedMany = `${manyTerms.join(' OR ')} ${manyNeg.join(' ')}`;
const repeatedMany = manyTerms.map((t) => `${t} ${manyNeg.join(' ')}`).join(' OR ');
assert(groupedMany === `(${manyTerms.join(' OR ')}) ${manyNeg.join(' ')}`);
assert(groupedMany.length === ungroupedMany.length + 2, `length delta ${groupedMany.length - ungroupedMany.length}`);
assert(groupedMany.length < repeatedMany.length, 'grouping is shorter than per-keyword exclusions');
ok(`length: grouped query is ungrouped + 2 chars (${groupedMany.length} vs repeating exclusions ${repeatedMany.length})`);

// Exact-keywords mode already grouped OR + exclusions. Lock that output.
assert(normalizeExactQuery('NFL OR NBA -scandal -lawsuit') === '(NFL OR NBA) -scandal -lawsuit');
assert(normalizeExactQuery('Nike -scandal') === 'Nike -scandal');
assert(normalizeExactQuery('NFL OR NBA') === '(NFL OR NBA)');
ok('exact-keywords OR/exclusion grouping unchanged');

// Exact mode must NOT use assembleQuery flattening even if queryTerms would flatten
const exactNotFlatten = simulateRouteSuggestedQuery({
  useExactKeywords: true,
  rawKeywordInput: 'A OR B AND (C OR D)',
  keywords: ['A OR B', '(C OR D)'],
  keywordOperator: 'AND',
  queryTerms: ['A', 'B', 'C', 'D'], // what old bug path would OR together
});
assert(exactNotFlatten === '(A OR B) (C OR D)', `got ${exactNotFlatten}`);
assert(exactNotFlatten !== assembleQuery(['A', 'B', 'C', 'D']), 'exact ignores flat queryTerms');
ok('exact mode ignores flat queryTerms (uses raw input)');

console.log(`\n=== Unit checks: ${passed} passed ===\n`);

// Optional live X API validation
function loadEnvLocal(): Record<string, string> {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnvLocal();
const token = env.X_API_BEARER_TOKEN || process.env.X_API_BEARER_TOKEN;

if (!token) {
  console.log('⚠ Skipping live X API check (no X_API_BEARER_TOKEN)\n');
  process.exit(0);
}

console.log('=== Live X API counts validation ===\n');

async function probe(query: string, label: string) {
  const end = new Date();
  const start = new Date(end.getTime() - 2 * 60 * 60 * 1000); // last 2 hours
  const params = new URLSearchParams({
    query,
    granularity: 'hour',
    start_time: start.toISOString(),
    end_time: new Date(end.getTime() - 60 * 1000).toISOString(),
  });
  const res = await fetch(`https://api.twitter.com/2/tweets/counts/all?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} — ${body.slice(0, 500)}`);
  }
  const json = JSON.parse(body);
  const total = json.meta?.total_tweet_count ?? json.meta?.total_tweet_count;
  console.log(`  ✓ ${label}: accepted (${res.status}), meta keys: ${Object.keys(json.meta || {}).join(', ') || 'n/a'}`);
  return json;
}

try {
  await probe(nba, 'NBA exact normalized query');
  await probe(grokExpected, 'Grok-optimize assembleQuery sample');
  // Prove the OLD flat bug query is still "valid syntax" to X (OR-only) but we already asserted we don't produce it.
  // Prove bare AND still fails:
  const bad = '"LeBron James" OR "Stephen Curry" AND (points OR rebounds)';
  const end = new Date();
  const start = new Date(end.getTime() - 2 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    query: bad,
    granularity: 'hour',
    start_time: start.toISOString(),
    end_time: new Date(end.getTime() - 60 * 1000).toISOString(),
  });
  const res = await fetch(`https://api.twitter.com/2/tweets/counts/all?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  if (res.ok) {
    throw new Error('Expected bare AND query to fail, but X accepted it');
  }
  assert(body.toLowerCase().includes('and') || res.status === 400, 'bare AND should 400');
  console.log(`  ✓ bare AND rejected by X as expected (${res.status})`);
  console.log('\nAll checks passed (unit + live X API).\n');
} catch (err) {
  console.error('\nLive X API check failed:', err);
  process.exit(1);
}
