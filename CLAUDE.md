@AGENTS.md
# TREND GENIUS CALCULATOR — PRODUCT SPEC & ENGINEERING RULES

## CORE PHILOSOPHY

This tool replaces a data scientist. Its purpose is to AUTOMATE judgment calls and ELIMINATE human error — not recreate it. Every validation, every checklist, every sanity check exists because a human got it wrong before. If Grok can catch a mistake that a strategist would miss, it should. If the server can enforce a rule that a human might forget, it must. The tool should be smarter than the person using it.

## READ THIS FIRST

This tool drives **real revenue** — it configures live ad triggers for brand partners spending millions of dollars. If thresholds are wrong, ads either never fire (wasted budget) or fire on noise (wasted impressions). Every calculation, every keyword, every query matters.

**Before changing ANY code**, understand the full data flow below. Do NOT make changes that seem locally correct but break downstream steps.

---

## WHAT THIS TOOL DOES

Trend Genius Calculator helps sales teams configure **Trend Genius ad triggers** on X (Twitter). It determines the right conversation volume thresholds so ads only run when a topic is genuinely trending — not during normal conversation levels.

It uses real hourly post volume data from X and AI analysis from Grok to recommend when ads should turn ON and OFF.

---

## TWO MODES

### 1. Campaign Setup (The Wizard) — 5 steps
For setting up a **new** campaign from scratch.

### 2. Threshold Analysis (Standalone)
For validating/adjusting thresholds on an **existing** campaign.

---

## CAMPAIGN SETUP — STEP-BY-STEP DATA FLOW

### Step 1: Details (Input Page)
User enters:
- X Handle (for brand context, NOT included in search query)
- Campaign start/end dates
- Keywords/topics with **AND/OR/SINGLE operator parsing**:
  - `Team Canada` → SINGLE topic, expand broadly
  - `Team Canada AND World Cup` → AND intersection, only terms relevant to BOTH
  - `NFL, NBA` or `NFL OR NBA` → OR union, expand each independently and combine
- Keyword mode: "Let Grok optimize" OR "Use exact keywords"
- Total ad spend budget (USD)
- Negation keywords checkbox (opt-in, unchecked by default)

### Step 2: Keywords (Grok Analysis)
Grok receives the user's inputs and returns:
- **queryTerms[]** — an array of individual search terms. The SERVER deduplicates and assembles these into the final query string via `assembleQuery()`. Grok does NOT build the query string itself.
- **excludedKeywords[]** — structured array of `{term, reason}` objects explaining which terms were considered but excluded, and why each was left out
- **queryWarnings[]** — advisory notes about query reliability, trigger consistency, or data limitations (e.g., topics that rely on subjective language and may trigger inconsistently)
- **Seasonality classification** — one of three types (see SEASONALITY section below)
- **Historical lookback period** — recommended date range for comparison data
- **Lookback query terms** (conditional) — a SEPARATE `lookbackQueryTerms[]` array for historical data when the lookback period needs different terms than the live campaign

The `suggestedKeywords` field has been **removed** — it is redundant now that `queryTerms[]` and `excludedKeywords[]` provide full visibility into what was included and excluded.

The user can override ANY of these values and hit "Re-analyze with Grok" to regenerate.

### Step 3: Data (Volume Fetch)
The tool fetches real hourly post volume from X using:
- The **lookback query** (if one exists) for the lookback date range
- The **campaign query** for everything else
- Displays: hours collected, total post volume, date range, volume chart

**CRITICAL**: If a lookback query exists, the data fetch MUST use the lookback query for historical data, NOT the campaign query.

### Step 4: Thresholds (Grok Recommendation)
Grok analyzes the historical volume data and recommends:
- **ON threshold** — posts/hour to start ads (targets top 5-10% of hours)
- **OFF threshold** — posts/hour to stop ads (lower than ON to prevent flicker)
- **Consecutive hours** — how many hours volume must stay above ON before triggering

Grok receives **both queries** when a lookback query exists:
- The **campaign query** (what will be used as the live trigger)
- The **lookback query** (what was actually used to fetch the volume data)
- This lets Grok reason correctly about the relationship between the data and the campaign

The SERVER computes:
- Estimated trend days (from historical spike frequency)
- Daily spend = total budget / estimated trend days
- Grok does NOT compute budget or daily spend — the server is the single source of truth for these numbers

User can edit all threshold values. Budget recalculates automatically.

### Step 5: Results (Summary & Export)
Final config summary with export options:
- Copy to clipboard (formatted plain text)
- Download as Word doc (.docx)
- Export data CSV (raw hourly volume)

---

## SEASONALITY CLASSIFICATION — THIS IS CRITICAL

Grok classifies every campaign into one of three types. Getting this wrong means pulling the wrong historical data, which means wrong thresholds, which means the campaign fails.

### Seasonal
- **What**: Follows a predictable annual cycle (NFL season, Christmas shopping, back-to-school)
- **Lookback**: Same time window LAST YEAR
- **Lookback query**: Usually same as campaign query (terms don't change year to year)
- **Example**: "NFL" in September → pull NFL data from September last year

### Non-seasonal / Evergreen
- **What**: Volume is relatively consistent year-round (a celebrity, a brand, a product)
- **Lookback**: Most recent period (e.g., last 30 days)
- **Lookback query**: Same as campaign query
- **Example**: "Taylor Swift" → pull the most recent 30 days

### Event-driven
- **What**: Tied to a specific event that doesn't repeat on a fixed schedule or changes location/context each occurrence
- **Lookback**: Data from the LAST OCCURRENCE of that event
- **Lookback query**: A SEPARATE query with year/location-swapped terms
- **Example**: "Team Canada" + World Cup 2026 dates →
  - Campaign query: terms about Canada in WC 2026 (vs Switzerland, vs Qatar, vs Bosnia, #WC2026)
  - Lookback query: terms about Canada in WC 2022 (vs Belgium, vs Croatia, vs Morocco, "Qatar 2022")
  - Lookback dates: Nov 20 – Dec 18, 2022 (the 2022 World Cup window)

**WHY THIS MATTERS**: For event-driven campaigns, the campaign query and lookback query MUST be different because the historical event had different opponents, host cities, hashtags, etc. If you use the 2026 campaign query to search 2022 data, you'll get zero results because "Canada vs Switzerland" wasn't a thing in 2022.

---

## KEYWORD OPTIMIZATION — GROK PROMPT RULES

When "Let Grok optimize" is selected, the Grok prompt must enforce:

### HANDLE CONTEXT
The X handle tells Grok WHO is advertising, which determines query scope:
- **Ambassador/partner** (e.g., @LouisVuitton + "zendaya") → build a BROAD query around the keyword. Any trending Zendaya moment is relevant because she's their ambassador. If they wanted narrow, they'd use AND.
- **General topic** (e.g., @DraftKings + "NBA") → the handle tells the ANGLE. DraftKings cares about NBA from a betting/fantasy perspective, so betting-related terms may be relevant additions.
- **Specific keyword** (e.g., @Walmart + "Black Friday deals") → handle just confirms context, no special scoping needed.
- When in doubt, go broad. The user can narrow with AND.

### AND/OR/SINGLE OPERATOR INTERPRETATION
The operator determines the SCOPE of keyword generation:
- **SINGLE**: Expand the topic broadly across all 9 checklist categories
- **AND**: Run the checklist but FILTER every term — only include terms relevant to ALL topics simultaneously
- **OR**: Run the full checklist for each topic independently, combine all terms
- Comma-separated input is treated as OR

### EVENT INFERENCE FROM CAMPAIGN DATES
Before working through the keyword checklist, Grok uses the campaign dates to identify any major events that overlap with the campaign window (sports schedules, cultural events, entertainment calendars). If the user's keywords relate to a specific event happening during those dates, checklist categories 5 and 6 become MANDATORY.

### NICHE FOCUS
- Query must focus on the user's specific niche, NOT the broader event
- "World Cup travel" → travel terms that spike during WC, not general soccer terms
- "Super Bowl food" → food/snack terms, not football terms
- If keywords are generic ("world cup", "NFL"), THEN cast a wide net

### WIDE NET — 9-CATEGORY CHECKLIST
Within the niche, Grok must systematically cover:
1. Official names and all recognized variations
2. Abbreviations & codes fans/media actually use
3. Hashtags (official + fan community, with and without #)
4. Casual/fan phrasing (how people actually tweet)
5. **Opponent/matchup terms** (confirmed matchups from campaign dates) — **MANDATORY when campaign dates overlap a known event**
6. **Event-specific terms** (year, host cities, tournament phases, venues) — **MANDATORY when campaign dates overlap a known event**. Only include event-level terms if COMBINED with the user's specific topic ("Canada World Cup" over "World Cup 2026")
7. Sport/category context qualifier (prevent false matches — "Canada soccer" not just "Canada")
8. Governing body & league terms — **specificity gate**: only include if the term is SPECIFIC to the user's topic. Generic terms like FIFA or CONCACAF match far more conversation than just the user's niche — exclude unless the campaign explicitly wants broad coverage.
9. Related community terms — **specificity gate**: same rule as category 8. Only include if specific to the user's topic, not broad related-team terms that would dilute the signal.

### SPECIFICITY
- Every term must be specific to the topic
- No standalone generic words ("final", "goal", "match")
- Use quoted multi-word phrases when needed ("World Cup final", not "final")

### NEGATION KEYWORDS
- Only included if the user checked the negation keywords checkbox
- NOT auto-included by default

### LOOKBACK QUERY DEPTH/COVERAGE MATCHING
When a lookback query is generated, it must match the campaign query in DEPTH and COVERAGE — same number of fan phrasing variations, same hashtag variants, same abbreviations. Only event-specific terms (opponents, years, venues, event hashtags) should differ. If the campaign query has 15 terms, the lookback query should have roughly 15 terms.

### DETERMINISM
- Grok returns a **queryTerms[] array**, not a query string
- Server runs `assembleQuery()` which deduplicates, quotes multi-word phrases, and joins with OR
- This ensures the same inputs always produce the same query

### FINAL SANITY CHECK
The Grok prompt includes a 6-item sanity check that Grok must pass before returning:
1. **Query coverage** — would 5 realistic fan tweets match at least one term?
2. **Query precision** — would ~80%+ of matching posts be relevant?
3. **Lookback validity** — is the lookback query structurally comparable to the campaign query?
4. **Signal vs noise** — are there any terms that would drown the real signal?
5. **Excluded keywords value** — would a sales strategist learn something from each exclusion?
6. **Triggering reliability** — can this topic be reliably detected via keyword matching? If it relies on subjective language, warn via `queryWarnings[]`

---

## THRESHOLD CALCULATION RULES

### Server-side only
- The server computes trend days and daily spend
- Grok does NOT do budget math — it only recommends ON/OFF/consecutive hours
- Budget fields: total budget (user input), est. trend days (server computed from historical data), max daily spend (budget / trend days)

### Adaptive rounding (cleanRound)
- `cleanRound()` is applied in **two places**:
  1. `calculate-thresholds/route.ts` — after Grok returns thresholds, before budget computation
  2. `ThresholdAnalysisStep.tsx` — in `applyTrendDaysEdit()` where ratio-based rounding could collapse ON === OFF
- Purpose: prevent edge case where ON threshold === OFF threshold for small values
- ON must always be strictly greater than OFF

### Hysteresis
- OFF must always be lower than ON
- The gap prevents rapid on/off cycling
- Typical ratio: OFF ≈ 60-80% of ON

---

## THRESHOLD ANALYSIS MODE (STANDALONE)

### Inputs
- Search query (paste existing trigger query)
- Campaign start/end dates
- Current ON threshold
- Current OFF threshold

### Flow
1. Fetch last 7 days of real data from X for the query
2. Display volume chart with ON/OFF lines overlaid
3. Grok analyzes the data and recommends: raise, lower, or keep thresholds
4. For each threshold hit, Grok explains WHY the topic was trending at that time
5. Shows confidence level and whether test data is representative of campaign dates

### CRITICAL BUG TO WATCH
ThresholdAnalysisStep must pass **both the campaign query AND the lookback query** to the threshold API when a lookback query exists. Grok needs both to reason correctly about the data. This has been a recurring bug — always verify which query variables are being passed.

---

## TEST CASES — ALWAYS VERIFY THESE WORK

### Test 1: Event-driven with lookback query
- Input: "Team Canada", dates June–July 2026
- Expected: Classified as event-driven, lookback query generated with 2022 WC terms (vs Belgium, vs Croatia, vs Morocco), lookback dates cover Nov–Dec 2022

### Test 2: Seasonal
- Input: "NFL", dates September–February
- Expected: Classified as seasonal, lookback = same window last year, no separate lookback query needed

### Test 3: Evergreen
- Input: "Nike", dates anytime
- Expected: Classified as non-seasonal/evergreen, lookback = most recent 30 days, no separate lookback query needed

### Test 4: Niche focus
- Input: "World Cup travel", dates June–July 2026
- Expected: Query focuses on travel terms (flights, hotels, fan travel, host city tourism), NOT general soccer terms

### Test 5: Threshold edge case
- Any campaign where volume is very low (< 10 posts/hour typical)
- Expected: ON and OFF thresholds must be different values (cleanRound prevents ON === OFF)

### Test 6: Negation keywords
- Input: any campaign, negation checkbox UNCHECKED
- Expected: no negation terms in query
- Input: same campaign, negation checkbox CHECKED
- Expected: negation terms included

### Test 7: Query determinism
- Run the same inputs through Grok twice
- Expected: identical query output both times (because server assembles the terms array)

### Test 8: AND operator
- Input: "Team Canada AND World Cup", dates June–July 2026
- Expected: Every term in the query is relevant to BOTH Team Canada AND the World Cup. No generic WC terms, no generic Canada terms.

### Test 9: OR operator
- Input: "NFL OR NBA"
- Expected: Full keyword expansion for NFL and full keyword expansion for NBA, combined

### Test 10: Ambassador handle context
- Input: @LouisVuitton handle, "zendaya" keyword
- Expected: Broad Zendaya query — all trending Zendaya conversation, not narrowed to fashion-only

---

## ARCHITECTURE INVARIANTS — DO NOT BREAK THESE

1. **Grok returns data, server builds strings** — Grok returns queryTerms[], server runs assembleQuery() to deduplicate/quote/join
2. **Server owns budget math** — Grok never computes trend days or daily spend
3. **Lookback query ≠ campaign query** for event-driven campaigns — they are separate fields, used in different places
4. **ThresholdAnalysisStep passes both queries** — campaign query AND lookback query go to the threshold API
5. **ON > OFF always** — cleanRound() enforces this in two places
6. **Negation keywords are opt-in** — checkbox unchecked by default
7. **excludedKeywords[] is structured** — array of `{term, reason}` objects, not a plain string
8. **queryWarnings[] is always returned** — empty array if no warnings, populated when trigger reliability is uncertain
9. **suggestedKeywords was removed** — redundant with queryTerms[] and excludedKeywords[]
10. **Grok model: grok-4.3** — do not use grok-3 (retired)
11. **AND/OR/SINGLE parsing lives in InputStep** — server and Grok receive the parsed operator, they don't re-parse

---

## WHEN MAKING CHANGES

1. Read this file first
2. Identify which step(s) your change touches
3. Trace the data flow downstream — will your change break a later step?
4. Run through the test cases above after ANY change
5. Do NOT refactor or "clean up" code that isn't part of the requested change
6. Show diffs before applying — do not auto-apply

---

## CODING GUIDELINES — READ BEFORE EVERY CHANGE

These reduce common LLM coding mistakes. They bias toward caution over speed.

### 1. Think Before Coding
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
