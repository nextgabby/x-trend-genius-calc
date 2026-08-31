import { normalizeExactQuery } from '../src/lib/query-syntax.ts';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Exact paste from the bug report (abbreviated only for readability of asserts —
 // full string is what strategists paste)
const input = `#210TriangleOfToughness, #ACC, #BBN, #Big12, #BigTen, #BirdsUp, #BleedBlue, #BoomerSooner, #BrickByBrick, #BuckeyeNation, #CalFamily, #CFB, #CFBPlayoff, #CollegeFootball, #CollegeFootballPlayoff, #CollegeGameday, #CommitToTheG, #CottonBowl, #Cyclones, #DawgNation, #FiestaBowl, #FightOn, #FootballSeason, #ForksUp, #FSU, #FunBelt, #Gators, #GeauxTigers, #GigEm, #GoBears, #GoBlue, #GoBucks, #gobuffs, #GoCanes, #GoDawgs, #GoDucks, #GoDuke, #GoGophers, #GoHogs, #GoIrish, #GoTerps, #GoVols, #HailState, #Hawkeyes, #HookEm, #hoosiers, #HootyHoo, #HottyToddy, #Huskers, #illini, #IUFB, #L1C4, #LSU, #MACtion, #Mizzou, #MIZZOUMADE, #NationalChampionship, #NCAAFB, #NeverDaunted, #NeverYield, #Noles, #OnWisconsin, #OrangeBowl, #OU, #OUohyeah, #OutHitOutHustle, #PawsUp, #PeachBowl, #RockChalk, #RollGoats, #RollTide, #RoseBowl, #RowTheBoat, #RTB, #SEC, #SicEm, #SolidOrange, #Spartans, #Sparty, #SpartyNation, #SugarBowl, #SunDevils, #TBDBITL, #TideNation, #ViceU, #WarEagle, #WeAre, #WeAre305, #WhiteOut, #WooPig, #WreckEm, Aggies, "Arch Manning", Auburn, "Auburn Tigers", Autzen, Bama, "Big Blue", "Big Noon Kickoff", Bryant-Denny, Buckeyes, "Calling the Hogs", "CFP rankings", Clemson, "Coach Prime", "Crimson Tide", "Curt Cignetti", "Death Valley", "Deion Sanders", "Drew Allar", "Egg Bowl", "Fighting Irish", Gators, "Georgia Bulldogs", "Go Dawgs", "Happy Valley", Heisman, Hoosiers, Canes, "Indiana Football", "Iron Bowl", "James Franklin", "Jeremiah Smith", "John Mateer", "Kirby Smart", "Kyle Field", "Lane Kiffin", Longhorns, LSU, Mizzou, "National Championship", NIL, "Nittany Lions", "Notre Dame", O-H-I-O, "Ohio State", "Ole Miss", "Oregon Ducks", "Penn State", "Playoff rankings", Rebels, Recruiting, "Red River Rivalry", "Red River Showdown", "Rivalry Week", "Rocky Top", Sooners, "Texas A&M", "The Horshoe", "The Swamp", "The U", "The Victors", "Transfer portal", Trojans, "Ty Simpson", USC, UT, Vols, Wolverines, "Woo Pig Sooie"`;

const out = normalizeExactQuery(input);

function fail(msg: string): never {
  console.error('FAIL:', msg);
  process.exit(1);
}

if (out.includes(',')) fail(`commas still present: ${out.slice(0, 120)}...`);
if (!out.includes(' OR ')) fail('missing OR');
if (!out.includes('#210TriangleOfToughness OR #ACC')) fail('start not OR-joined');
if (!out.includes('"Arch Manning"')) fail('missing Arch Manning quotes');
if (!out.includes('"Texas A&M"')) fail('missing Texas A&M');
if (!out.includes('O-H-I-O')) fail('missing O-H-I-O');
if (/\bAND\b/.test(out.replace(/"[^"]*"/g, '""'))) fail('bare AND present');

console.log('normalized length:', out.length);
console.log('OR count:', (out.match(/ OR /g) || []).length);
console.log('preview:', out.slice(0, 180) + '...');
console.log('unit OK');

// Live X API — use a short subset (full list may exceed query length limits)
function loadEnv(): Record<string, string> {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return {};
  const outEnv: Record<string, string> = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) outEnv[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return outEnv;
}

const token = loadEnv().X_API_BEARER_TOKEN || process.env.X_API_BEARER_TOKEN;
if (!token) {
  console.log('skip live X (no token)');
  process.exit(0);
}

const subset = normalizeExactQuery(
  '#RollTide, #WarEagle, "Crimson Tide", Auburn, "Arch Manning", "Texas A&M"'
);
console.log('subset for X:', subset);

async function probe(query: string, label: string) {
  const end = new Date(Date.now() - 60_000);
  const start = new Date(end.getTime() - 2 * 3600_000);
  const params = new URLSearchParams({
    query,
    granularity: 'hour',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  });
  const res = await fetch(`https://api.twitter.com/2/tweets/counts/all?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(label, res.status, body.slice(0, 400));
    process.exit(1);
  }
  console.log(`✓ ${label}: ${res.status}`);
}

// Comma paste (bad) should fail
{
  const bad = '#RollTide, #WarEagle, Auburn';
  const end = new Date(Date.now() - 60_000);
  const start = new Date(end.getTime() - 2 * 3600_000);
  const params = new URLSearchParams({
    query: bad,
    granularity: 'hour',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  });
  const res = await fetch(`https://api.twitter.com/2/tweets/counts/all?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    console.warn('note: raw comma query unexpectedly accepted by X');
  } else {
    console.log(`✓ raw comma query rejected by X (${res.status}) as expected`);
  }
}

await probe(subset, 'comma→OR subset');
await probe(
  normalizeExactQuery('Shai Gilgeous-Alexander OR Nikola Jokic AND (points OR rebounds)'),
  'NBA AND case'
);
console.log('all passed');
