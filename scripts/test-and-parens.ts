import { normalizeExactQuery, ensureXQuerySyntax } from '../src/lib/query-syntax.ts';

const cases: [string, string][] = [
  ['#RollTide, #WarEagle, Auburn', '(#RollTide OR #WarEagle OR Auburn)'],
  ['Team Canada AND World Cup', '("Team Canada") ("World Cup")'],
  ['A OR B AND (C OR D)', '(A OR B) (C OR D)'],
  [
    'Shai Gilgeous-Alexander OR Nikola Jokic AND (points OR rebounds OR triple double)',
    '("Shai Gilgeous-Alexander" OR "Nikola Jokic") (points OR rebounds OR "triple double")',
  ],
  ['#SEC, #BigTen AND Heisman', '(#SEC OR #BigTen) (Heisman)'],
];

let fail = 0;
for (const [input, expected] of cases) {
  const got = normalizeExactQuery(input);
  const ok = got === expected;
  console.log(ok ? '✓' : '✗', input);
  console.log('  →', got);
  if (!ok) {
    console.log('  expected:', expected);
    fail++;
  }
}

console.log('ensure:', ensureXQuerySyntax('a, b AND c'));
process.exit(fail ? 1 : 0);
