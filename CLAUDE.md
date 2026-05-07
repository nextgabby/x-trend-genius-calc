@AGENTS.md
# TREND GENIUS CALCULATOR — PRODUCT SPEC & ENGINEERING RULES

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
- Keywords/topics (comma-separated)
- Keyword mode: "Let Grok optimize" OR "Use exact keywords"
- Total ad spend budget (USD)
- Negation keywords checkbox (opt-in, unchecked by default)

### Step 2: Keywords (Grok Analysis)
Grok receives the user's inputs and returns:
- **queryTerms[]** — an array of individual search terms. The SERVER sorts, deduplicates, and joins these into the final query string. Grok does NOT build the query string itself.
- **excludedKeywords[]** — terms Grok considered but excluded, with reasons why
- **Seasonality classification** — one of three types (see SEASONALITY section below)
- **Historical lookback period** — recommended date range for comparison data
- **Lookback query** (conditional) — a SEPARATE query for historical data when the lookback period needs different terms than the live campaign

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
5. Opponent/matchup terms (confirmed matchups from campaign dates)
6. Event-specific terms (year, host cities, tournament phases, venues)
7. Sport/category context qualifier (prevent false matches — "Canada soccer" not just "Canada")
8. Governing body & league terms (FIFA, CONCACAF, etc.)
9. Related community terms (only if campaign brief suggests broader coverage)

### SPECIFICITY
- Every term must be specific to the topic
- No standalone generic words ("final", "goal", "match")
- Use quoted multi-word phrases when needed ("World Cup final", not "final")

### NEGATION KEYWORDS
- Only included if the user checked the negation keywords checkbox
- NOT auto-included by default

### DETERMINISM
- Grok returns a **queryTerms[] array**, not a query string
- Server sorts alphabetically, deduplicates, and joins with OR
- This ensures the same inputs always produce the same query

---

## THRESHOLD CALCULATION RULES

### Server-side only
- The server computes trend days and daily spend
- Grok does NOT do budget math — it only recommends ON/OFF/consecutive hours
- Budget fields: total budget (user input), est. trend days (server computed from historical data), max daily spend (budget / trend days)

### Adaptive rounding (cleanRound)
- Use cleanRound() when computing threshold values
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
ThresholdAnalysisStep must pass the **lookback query** (not the campaign query) to the threshold API when a lookback query exists. This has been a recurring bug — always verify which query variable is being passed.

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
- Expected: identical query output both times (because server sorts/deduplicates the terms array)

---

## ARCHITECTURE INVARIANTS — DO NOT BREAK THESE

1. **Grok returns data, server builds strings** — Grok returns queryTerms[], server sorts/deduplicates/joins
2. **Server owns budget math** — Grok never computes trend days or daily spend
3. **Lookback query ≠ campaign query** for event-driven campaigns — they are separate fields, used in different places
4. **ThresholdAnalysisStep uses lookback query** for the threshold API call
5. **ON > OFF always** — cleanRound() enforces this
6. **Negation keywords are opt-in** — checkbox unchecked by default
7. **excludedKeywords[] is always returned** — user can see what was filtered and why
8. **Grok model: grok-4.3** — do not use grok-3 (retiring May 15)

---

## WHEN MAKING CHANGES

1. Read this file first
2. Identify which step(s) your change touches
3. Trace the data flow downstream — will your change break a later step?
4. Run through the test cases above after ANY change
5. Do NOT refactor or "clean up" code that isn't part of the requested change
6. Show diffs before applying — do not auto-apply
