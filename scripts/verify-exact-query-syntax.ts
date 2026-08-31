/**
 * Verification script for exact-keywords query syntax vs Grok-optimize assembleQuery.
 * Run: node --experimental-strip-types scripts/verify-exact-query-syntax.ts
 */
import { normalizeExactQuery, ensureXQuerySyntax } from '../src/lib/query-syntax.ts';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// --- Mirror of assembleQuery from analyze-keywords/route.ts (Grok optimize path) ---
function assembleQuery(terms: string[]): string {
  const cleaned = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
  const positive = cleaned.filter((t) => !t.startsWith('-'));
  const negations = cleaned.filter((t) => t.startsWith('-'));
  const positiveQuery = positive
    .map((term) => (term.includes(' ') && !term.startsWith('#') ? `"${term}"` : term))
    .join(' OR ');
  if (negations.length > 0) {
    const negationStr = negations
      .map((term) => {
        const inner = term.slice(1);
        if (inner.startsWith('"') && inner.endsWith('"')) return term;
        if (inner.includes(' ')) return `-"${inner}"`;
        return term;
      })
      .join(' ');
    return `${positiveQuery} ${negationStr}`;
  }
  return positiveQuery;
}

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
const grokExpected = assembleQuery(grokTerms);
assert(grokRoute === grokExpected, 'optimize uses assembleQuery');
assert(grokRoute === '"Canada National Team" OR CanMNT OR #CanadaSoccer OR "Canada vs Switzerland" -scandal', `got ${grokRoute}`);
ok('Grok optimize route → assembleQuery (all OR + trailing negations)');

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
