import type { StatsResult } from './types';

export function buildKeywordAnalysisPrompt(
  handle: string,
  keywords: string[],
  campaignStartDate: string,
  campaignEndDate: string,
  seasonalityOverride?: string,
  useExactKeywords?: boolean,
  includeNegations?: boolean,
  keywordOperator?: 'AND' | 'OR' | 'SINGLE'
): string {
  const operator = keywordOperator || 'SINGLE';
  const seasonalityInstruction = seasonalityOverride
    ? `\n\nIMPORTANT: The user has specified that the seasonality type MUST be "${seasonalityOverride}". You MUST use this exact seasonality classification — do not override it with your own assessment. Adjust your lookback period recommendation accordingly based on this seasonality type.`
    : '';

  const exactKeywordsInstruction = useExactKeywords
    ? `\n\nCRITICAL — EXACT KEYWORDS MODE (STRICT): The user has provided client-approved keywords that MUST be used EXACTLY as-is with ZERO modifications. Rules:
- Build the suggestedQuery by joining ONLY the provided keywords with OR operators. Do NOT add ANY new keywords, hashtags, hashtag variants, abbreviations, synonyms, related terms, expanded terms, or brainstormed alternatives.
- Do NOT add terms with or without "#" — if the user provided "NFL", do NOT add "#NFL". If the user provided "#NFL", do NOT add "NFL". Use ONLY what was given.
${includeNegations ? '- The ONLY additions allowed are contextual negation terms (-term) at the end for brand safety.' : '- Do NOT add any terms that were not in the original input — including negation terms (-term). No additions of any kind.'}
- The queryTerms array MUST contain ONLY the provided keywords — no additions.
- If you add even ONE keyword that was not in the original input, you have failed this task.`
    : '';

  return `You are an expert in X (Twitter) advertising and search query syntax. Today's date is ${new Date().toISOString().split('T')[0]}.

A user wants to set up Trend Genius ad triggers for the following campaign:
- Advertiser X Handle: @${handle}
- Campaign Dates: ${campaignStartDate} to ${campaignEndDate}
- Keywords/Topics: ${keywords.join(` ${operator === 'AND' ? 'AND' : 'OR'} `)}
- Keyword Operator: ${operator}${exactKeywordsInstruction}

The handle @${handle} is provided so you can understand the brand's vibe, audience, and the type of sentiment/conversation that surrounds them. Use this context to craft a query that captures the kind of organic conversation that would be relevant to this brand's campaign — but do NOT include the handle itself in the search query.

HOW TO USE THE HANDLE CONTEXT:
The handle tells you WHO is advertising, which helps you make judgment calls about query scope:
- If the keyword IS the brand's ambassador/partner/spokesperson (e.g., @LouisVuitton + "zendaya"), the user likely wants ALL conversation about that person — any trending Zendaya moment is relevant to LV because she's their ambassador. Build a broad query around the keyword, not a narrow brand-intersection query. If they wanted only fashion-related Zendaya conversation, they would have typed "zendaya AND fashion."
- If the keyword is a general topic (e.g., @DraftKings + "NBA"), the handle tells you the ANGLE — DraftKings cares about NBA from a betting/fantasy perspective, so terms like "player props", "over/under", and "parlay" might be relevant additions.
- If the keyword is already specific (e.g., @Walmart + "Black Friday deals"), the handle just confirms the context — no special scoping needed.
- When in doubt, go broad. The user can always narrow with the AND operator. It's better to capture too much relevant conversation than to miss spikes because the query was too narrow.

Your tasks:

1. CAMPAIGN QUERY CONSTRUCTION (suggestedQuery)
This query will be used as the LIVE TRIGGER for the Trend Genius campaign — it determines when ads fire.

- Validate whether these keywords are suitable for monitoring post volume on X.
- Suggest an optimized X search query using proper syntax (OR operators, quoted phrases, negations).
- DO include retweets — do NOT add -is:retweet. We want total conversation volume including retweets.

KEYWORD INPUT INTERPRETATION:
The user's keywords use AND/OR operators to express their intent precisely. How you interpret them is critical:

SINGLE TOPIC (no operator):
  Input: "Team Canada"
  Meaning: Expand this topic broadly. Use the campaign dates to determine context (sport, event, etc.) and generate all relevant variations, hashtags, fan terms, and matchup terms.
  Example output: Canada National Team, Canadian men's soccer, CanMNT, #CanadaSoccer, Canada vs Switzerland, etc.

AND (intersection):
  Input: "Team Canada AND World Cup"
  Meaning: ONLY generate terms that relate to BOTH topics simultaneously. Do not include generic World Cup terms (Spain national team, FIFA rankings) that aren't Canada-specific. Do not include generic Canada soccer terms (friendly matches, CONCACAF qualifiers) that aren't World Cup-specific.
  Example output: Canada vs Switzerland, Canada vs Qatar, CanMNT World Cup, #CanadaSoccer (during WC window), Canada World Cup group stage — every term must be relevant to BOTH Team Canada AND the World Cup.

OR (union):
  Input: "NFL OR NBA"
  Meaning: Expand each topic independently and combine all terms. The resulting query should capture conversation about EITHER topic.
  Example output: all NFL terms OR'd with all NBA terms.

COMMA = OR:
  Commas are treated as OR. "NFL, NBA" is the same as "NFL OR NBA".

The operator determines the SCOPE of keyword generation. AND narrows it. OR widens it. Getting this wrong means the campaign either misses relevant conversation (too narrow) or triggers on irrelevant conversation (too wide).

HOW THE OPERATOR AFFECTS THE CHECKLIST:
- SINGLE or OR: Run the full 9-category checklist for each topic independently, then combine all terms.
- AND: Run the checklist but FILTER every term — only include terms that satisfy BOTH topics. If a term from any category is only relevant to one topic, exclude it.

NICHE FOCUS (CRITICAL):
- The campaign query MUST focus ONLY on the user's specific niche or angle, NOT the broader event/topic.
- Look at the user's keywords to understand their INTENT. If they say "world cup travel", they want TRAVEL conversation around the World Cup — NOT general World Cup sports discussion. Build the query around travel-specific terms (flights, hotels, fan travel, host city tourism, etc.) that happen to spike during the World Cup.
- Similarly, "Super Bowl food" → food/snack/party terms that spike during Super Bowl, NOT general football terms. "Olympics fashion" → fashion/style terms during Olympics, NOT medal counts.
- If the keywords indicate a general topic (just "world cup" or "NFL"), THEN cast a wide net with all variations.
- The trigger query should match the ACTUAL conversation niche the advertiser wants to ride.

WIDE NET WITHIN THE NICHE — KEYWORD COVERAGE CHECKLIST:
Within the identified niche, systematically work through EACH of these 9 categories and include all relevant terms. Skip a category only if it genuinely doesn't apply.

BEFORE working through the checklist, use the campaign dates to identify any major events that overlap with the campaign window. Use your knowledge of sports schedules, cultural events, and entertainment calendars to determine if the user's keywords relate to a specific event happening during those dates. If they do, categories 5 (opponent/matchup terms) and 6 (event-specific terms) are MANDATORY — you must populate them using your knowledge of that event (confirmed matchups, host cities, venues, year-specific hashtags, etc.). Do not skip these categories just because the user didn't explicitly name the event.

Example: "Team Canada" + dates June–July 2026 → this overlaps with the 2026 FIFA World Cup. Canada is in Group B vs Switzerland, Qatar, and Bosnia. You MUST include those matchup terms and event terms.

1. OFFICIAL NAMES — Full official name of the team/org/event and all recognized variations (e.g., "Canada men's national soccer team", "Canadian men's national team", "Canada National Team")
2. ABBREVIATIONS & CODES — Standard abbreviations fans and media actually use (e.g., CanMNT, USMNT, FIFA, UEFA, NFL)
3. HASHTAGS — Both official and fan-community hashtags, with and without # (e.g., #CanadaSoccer, CanadaSoccer, #CanMNT, #WC2026). Include hashtags people actually use on X, not ones you invent.
4. CASUAL/FAN PHRASING — How real fans talk about this on X (e.g., "Team Canada soccer", "Canada soccer match", "Canadian soccer game"). Think about how someone would tweet about this, not how a press release would describe it.
5. OPPONENT/MATCHUP TERMS — If this is a competition, include "Team A vs Team B" pairings for confirmed opponents (e.g., "Canada vs Switzerland", "Canada vs Qatar"). Use the campaign dates to determine which specific matchups are relevant.
6. EVENT-SPECIFIC TERMS — Year-specific terms, host city names, tournament phases, venue names that are relevant to the campaign window (e.g., "World Cup 2026", "BMO Field", "group stage"). Only include event-level terms if they are COMBINED with the user's specific topic. "World Cup 2026" alone matches ALL World Cup conversation — if the campaign is about Team Canada, do not include generic tournament-wide terms. Instead, prefer terms that tie the event to the topic (e.g., "Canada World Cup" over "World Cup 2026").
7. SPORT/CATEGORY CONTEXT — Add the sport or category qualifier to prevent false matches (e.g., "Canada soccer" not just "Canada", "Team Canada soccer" not just "Team Canada" which could be hockey/Olympics/curling)
8. GOVERNING BODY & LEAGUE TERMS — Relevant governing bodies, leagues, or organizing entities that fans reference (e.g., FIFA, CONCACAF, MLS). Only include if the term is SPECIFIC to the user's topic. Generic governing body terms (FIFA, CONCACAF) or broad related-team terms match far more conversation than just the user's niche — exclude them unless the campaign explicitly wants broad coverage.
9. RELATED COMMUNITY TERMS — Adjacent fan communities or related teams whose conversation overlaps with your niche (e.g., for Canada WC: USMNT, "Mexico national team" — only include if the campaign brief suggests broader coverage). Only include if the term is SPECIFIC to the user's topic. Generic governing body terms (FIFA, CONCACAF) or broad related-team terms match far more conversation than just the user's niche — exclude them unless the campaign explicitly wants broad coverage.

After working through the checklist, review the full list and remove any term that fails the SPECIFICITY test above.

SPECIFICITY IS CRITICAL:
- Every keyword in the query must be SPECIFIC to the topic. Do NOT include generic words that have broad meanings outside the topic. For example, "final" alone could mean anything — use "World Cup final" instead. "Goal" alone is too generic — use "soccer goal" or "#WorldCupGoal". "Match" alone is ambiguous — use "World Cup match".
- When in doubt, use quoted multi-word phrases to ensure specificity (e.g., "group stage" not just stage).
- Single common English words should NEVER appear alone in the query unless they are unambiguously tied to the topic (e.g., "FIFA" is fine because it only means one thing).

${includeNegations ? `CONTEXTUAL NEGATIONS:
- Think carefully about what real-world topics, events, or conversations could overlap with the keywords but would be OFF-TOPIC or inappropriate for the brand.
- Add negation operators (-term) to filter these out. Examples:
  - For a Call of Duty campaign: negate real-world war, military conflict, current geopolitical events (e.g., -Ukraine -Afghanistan -"war crimes" -invasion -bombing) so the query captures gaming conversation, not news about actual wars.
  - For a World Cup campaign: negate gambling/betting terms if the brand doesn't want that association (e.g., -bet -odds -wager).
  - For a food brand: negate food poisoning, recalls, lawsuits, etc.
- The negations should be specific to the brand and topic — do NOT add generic profanity filters. Only negate terms that would cause the query to pick up conversations unrelated to the campaign or damaging to the brand's context.
- Place all negations at the end of the query.
- List your negations and reasoning in the "reasoning" field so the user can review them.` : `NEGATIONS:
- Do NOT add any negation operators (-term) to the query. The user has opted out of automatic negation keywords. Build the query using only positive match terms.`}

QUERY OUTPUT FORMAT:
Do NOT return a fully assembled query string. Instead, return TWO arrays:

queryTerms: string[] — each individual search term as a separate array entry
  Example: ["Canada National Team", "Canadian men's soccer", "CanMNT", "#CanadaSoccer", "Canada vs Switzerland"]
  - Each term should be the raw phrase WITHOUT surrounding quotes — the server adds quotes to multi-word phrases automatically
  - Hashtags keep their # prefix
  - Single words stay as-is (e.g., "CanMNT", "USMNT")

lookbackQueryTerms: string[] | null — same format, for the lookback query. Null if no separate lookback query is needed.

2. SEASONALITY CLASSIFICATION
Determine the seasonality type. This is critical — getting this wrong means looking at the wrong historical data.

- "seasonal" — ONLY for topics where the EXACT SAME keywords recur on a predictable annual cycle. Examples: NFL, NBA, MLB seasons, Christmas, back-to-school, tax season, Black Friday. The key test: would searching these exact keywords in last year's same time window show a comparable conversation pattern? If yes → seasonal.
- "non-seasonal" — for topics where the specific content/subjects change over time, even if the broader category is ongoing. This includes:
  - Streaming/entertainment content (Disney+, Netflix, HBO shows) — the specific titles in the query (e.g., "Daredevil Born Again", "X-Men 97 Season 2") are NEW releases that didn't exist last year. Looking back a year would show conversation about completely different shows. Use recent data instead.
  - Celebrities, influencers, brand ambassadors — their relevance is current, not cyclical.
  - Brand names, general interest topics — conversation volume reflects current events, not annual patterns.
  - Any query containing specific show/movie/album/product TITLES that were released or announced recently.
- "event-driven" — tied to a specific upcoming one-off event (product launch, award show, World Cup, Olympics). The event itself may be periodic but the keywords are specific to THIS instance.

ASK YOURSELF: If I search these exact keywords in last year's data from the same dates, would I get meaningful comparable volume? If the answer is NO (because the shows/products/events didn't exist yet), it is NOT seasonal.

3. HISTORICAL LOOKBACK PERIOD (CRITICAL)
Recommend the best historical date range to pull post volume data from. The lookback period MUST match the seasonality classification:

- "seasonal" → Use the SAME time window from LAST YEAR. E.g., NFL campaign Sep 5–Dec 20 → look at Sep 5–Dec 20 of the previous year. This works because the same keywords (NFL, football, touchdown) generate comparable volume every year.
- "non-seasonal" → Use the MOST RECENT period, matching the same duration as the campaign. E.g., if the campaign is 3 months, look at the most recent 3 months. This captures the current baseline for these specific titles/topics.
- "event-driven" → For periodic events (World Cup, Olympics): look at the LAST occurrence of that event. For one-off events: use the most recent period matching campaign duration.

The lookback dates must be in the past (before today). Return them as ISO date strings (YYYY-MM-DD).

4. LOOKBACK QUERY (required when campaign query contains event-specific terms)

After building the campaign query, review it for any terms from checklist categories 5 (opponent/matchup terms) and 6 (event-specific terms). If ANY such terms exist, a separate lookbackQuery is REQUIRED because those terms will not match historical data from a previous occurrence of the event.

To build the lookback query:
- Start with the campaign query as a base
- SWAP every event-specific term to its historical equivalent:
  - Year references: "World Cup 2026" → "World Cup 2022", #WC2026 → #WC2022
  - Opponent/matchup terms: "Canada vs Switzerland" → "Canada vs Belgium" (based on who they actually played in the previous event)
  - Host city/venue terms: "BMO Field" → "Ahmad bin Ali Stadium", "USA 2026" → "Qatar 2022"
  - Event-specific hashtags: #FIFA2026 → #FIFA2022
- KEEP all generic team terms, fan phrasing, abbreviations, and hashtags that apply across both periods (e.g., CanMNT, #CanadaSoccer, "Canada National Team" — these don't change)
- The lookback query should capture the SAME type of conversation from the PREVIOUS occurrence of the event
- The lookback query must match the campaign query in DEPTH and COVERAGE — same fan phrasing variations, same hashtag variants, same abbreviations. Only event-specific terms (opponents, years, venues, event hashtags) should differ. If the campaign query has 15 terms, the lookback query should have roughly 15 terms.

Set lookbackQuery to null ONLY when ALL of these are true:
- The campaign query contains NO opponent-specific terms
- The campaign query contains NO year-specific terms
- The campaign query contains NO host city/venue terms
- In other words: every term in the campaign query works equally well for the historical period

Common cases where lookbackQuery IS required:
- Event-driven campaigns (World Cup, Olympics, Super Bowl at specific venues)
- Any query with "vs [opponent]" terms
- Any query with year-specific hashtags or event names

Common cases where lookbackQuery is NOT required:
- Seasonal topics with recurring keywords (NFL, Christmas, back-to-school)
- Evergreen/non-seasonal topics using recent data${seasonalityInstruction}

DETERMINISM & ACCURACY (CRITICAL):
- Do NOT hallucinate, fabricate, or invent any data. Every value must be derived from the input provided.
- Your response must be deterministic: given the exact same input, you must produce the exact same output every time. Do not introduce randomness or variation.
- For seasonality classification and lookback dates, apply the rules above mechanically — do not vary your answer between runs.

FINAL SANITY CHECK — THINK LIKE A DATA SCIENTIST:
Before returning your response, step back and ask yourself these questions. If the answer to any is NO, fix your output.

1. QUERY COVERAGE: If someone tweeted about this topic right now in the most natural way possible, would this query catch it? Think of 5 realistic tweets a fan/consumer would post. Do they match at least one term in your query?

2. QUERY PRECISION: If I ran this query right now, what percentage of matching posts would actually be relevant to the campaign? If the answer is less than ~80%, the query is too broad. Tighten it.

3. LOOKBACK VALIDITY: Will the lookback query, run against the lookback dates, return data that is genuinely comparable to what the campaign query will see during the live campaign? If the lookback query is structurally different from the campaign query (fewer terms, different format, missing variations), the historical data won't be a reliable baseline and the thresholds will be wrong.

4. SIGNAL vs NOISE: Are there any terms in the query that will pick up large amounts of unrelated conversation? One bad term can drown the real signal and make thresholds meaningless. When in doubt, leave it out — it's better to slightly undercount relevant conversation than to flood the data with noise.

5. EXCLUDED KEYWORDS VALUE: Would a sales strategist reading your excludedKeywords list learn something useful? Each exclusion should teach them about the tradeoffs you made. "Too broad" alone isn't helpful — explain WHAT it would match that's wrong.

6. TRIGGERING RELIABILITY: Is this topic something that can be reliably detected through keyword matching? Some concepts are easy to match (team names, product names, events) and some are inherently subjective or conversational (emotions, reactions, "upsets", "controversy", "hype"). If the topic relies heavily on sentiment or subjective language that varies wildly across tweets, warn the user that trigger behavior may be inconsistent and suggest more concrete alternative terms they could add. Include this warning in the queryWarnings field.

Respond ONLY with valid JSON in this exact format:
{
  "isValid": true,
  "queryTerms": ["each", "individual", "search", "term", "#AsItsOwnEntry"],
  "reasoning": "brief explanation of your query choices and niche focus",
  "excludedKeywords": [{"term": "FIFA", "reason": "Too broad — matches all soccer, not just Canada"}],
  "seasonality": "seasonal" | "non-seasonal" | "event-driven",
  "seasonalityExplanation": "why you chose this seasonality type",
  "lookbackStartDate": "YYYY-MM-DD",
  "lookbackEndDate": "YYYY-MM-DD",
  "lookbackReasoning": "explain why this historical period is the best predictor for the campaign",
  "lookbackQueryTerms": null or ["adapted", "terms", "for", "historical", "period"],
  "lookbackQueryReasoning": null or "explain how the lookback query was adapted and why",
  "queryWarnings": ["any advisory notes about query reliability, trigger consistency, or data limitations — empty array if none"]
}`;
}

export function buildThresholdAnalysisPrompt(
  query: string,
  stats: StatsResult,
  seasonality: string,
  campaignStartDate: string,
  campaignEndDate: string,
  lookbackQuery?: string
): string {
  // Compute campaign duration in days
  const campStart = new Date(campaignStartDate);
  const campEnd = new Date(campaignEndDate);
  const campaignDays = Math.round((campEnd.getTime() - campStart.getTime()) / (1000 * 60 * 60 * 24));

  // Format day-of-week averages
  const dowLines = Object.entries(stats.dayOfWeekAvg)
    .map(([day, avg]) => `  ${day}: ${avg} posts/hour`)
    .join('\n');

  // Format hour-of-day averages (top 6 highest + top 6 lowest for brevity)
  const hourEntries = Object.entries(stats.hourOfDayAvg).sort((a, b) => b[1] - a[1]);
  const peakHourLines = hourEntries.slice(0, 6).map(([h, avg]) => `  ${h}:00 UTC: ${avg}`).join('\n');
  const quietHourLines = hourEntries.slice(-6).map(([h, avg]) => `  ${h}:00 UTC: ${avg}`).join('\n');

  return `You are an expert Advertising Trigger System analyst specializing in X (Twitter) post volume analysis for Trend Genius campaigns.

You have been given hourly post volume statistics for the following query on X:
${lookbackQuery
  ? `Query (live campaign trigger): ${query}
Historical Data Query: ${lookbackQuery} (this is the query used to fetch the volume data below — it differs from the campaign query because the historical period had different event-specific terms)`
  : `Query: ${query}`}
Campaign Dates: ${campaignStartDate} to ${campaignEndDate} (${campaignDays} days)
Seasonality: ${seasonality}

Historical Hourly Volume Statistics:
- Total data points (hours): ${stats.totalDataPoints}
- Total calendar days in data: ${stats.totalDaysInData}
- Mean: ${stats.mean} posts/hour
- Median: ${stats.median} posts/hour
- Standard Deviation: ${stats.stdDev}
- Min: ${stats.min} posts/hour
- Max: ${stats.max} posts/hour
- 25th percentile: ${stats.p25} posts/hour
- 75th percentile: ${stats.p75} posts/hour
- 90th percentile: ${stats.p90} posts/hour
- 95th percentile: ${stats.p95} posts/hour
- 99th percentile: ${stats.p99} posts/hour
- Quiet hours (below 25% of mean): ${stats.quietHourPct}%

Day-of-Week Average Volume (posts/hour):
${dowLines}

Peak Hours (UTC, top 6 by average volume):
${peakHourLines}
Quietest Hours (UTC, bottom 6):
${quietHourLines}

Spike Analysis (spikes = contiguous periods above P90):
- Distinct spike events: ${stats.spikeCount}
- Average spike duration: ${stats.avgSpikeDurationHours} hours
- Calendar days with spike activity: ${stats.spikeDays} out of ${stats.totalDaysInData} days (${stats.totalDaysInData > 0 ? Math.round((stats.spikeDays / stats.totalDaysInData) * 100) : 0}%)

Based on this data, recommend ON and OFF thresholds for the Trend Genius trigger system.

The goal is to ONLY trigger ads during genuine SPIKES — the big, obvious surges in conversation that stand out dramatically from the baseline. This is NOT about capturing above-average volume; it's about identifying moments when something is genuinely trending or breaking through.

ON THRESHOLD GUIDELINES:
- The ON threshold should target the TOP of the distribution — the clear spikes, not just "above average" hours.
- Start at the 90th-95th percentile as your baseline, then adjust UP based on these factors:
  - If the standard deviation is high relative to the mean (stdDev > 0.3 * mean), there are real spikes — set the threshold closer to P95 or higher to only catch the genuine surges.
  - If the data has a "fat tail" (P99 is much larger than P95), there are extreme spikes — the threshold can be set between P90 and P95 to catch those moments.
  - If the volume is consistently high with little variation (low stdDev relative to mean), set the threshold higher (P95+) since most hours look similar and you only want the outliers.
- The ON threshold should trigger on roughly 5-10% of hours at most — not 20-25%.
- Round the threshold to a clean number (e.g., 15000 not 14919).

OFF THRESHOLD GUIDELINES:
- Set the OFF threshold with meaningful hysteresis — typically 25-40% below the ON threshold.
- It should be well above the median to avoid staying "on" during normal volume.
- The gap between ON and OFF should be wide enough to prevent rapid cycling.

CONSECUTIVE HOURS:
- Recommend the number of consecutive hours above the ON threshold before triggering.
- Use the spike analysis data: if average spike duration is ${stats.avgSpikeDurationHours} hours, set consecutive hours to ensure you catch real spikes (typically 2, but adjust based on the data).

PEAK HOURS:
- Use the hour-of-day data provided above to identify actual peak hours. Convert UTC to EST (UTC-5) for the response.
- Also consider day-of-week patterns — note which days have the highest volume.

CONFIDENCE:
- Provide a confidence level (high/medium/low) based on data quality and volume.

DETERMINISM & ACCURACY (CRITICAL):
- Do NOT hallucinate, fabricate, or invent any numbers. Every threshold, metric, and estimate must be derived directly from the statistical data provided above.
- Your response must be deterministic: given the exact same input statistics, you must produce the exact same thresholds, estimates, and recommendations every time. Do not introduce randomness or variation.
- Use the exact statistical values provided — do not approximate or recalculate them differently between runs.
- The avgHourlyVolume, medianHourlyVolume, stdDeviation, p75, p90, and p95 fields MUST exactly match the values provided in the input above.

Respond ONLY with valid JSON in this exact format:
{
  "onThreshold": <number>,
  "offThreshold": <number>,
  "consecutiveHours": <number>,
  "confidence": "high" | "medium" | "low",
  "reasoning": "detailed explanation of how you determined the thresholds",
  "peakHours": ["list of typical peak hour ranges, e.g. '6PM-10PM EST'"],
  "avgHourlyVolume": ${stats.mean},
  "medianHourlyVolume": ${stats.median},
  "stdDeviation": ${stats.stdDev},
  "p75": ${stats.p75},
  "p90": ${stats.p90},
  "p95": ${stats.p95}
}`;
}

export interface TweetSampleForPrompt {
  text: string;
  created_at: string;
  retweets?: number;
  likes?: number;
}

export interface SpikeContext {
  timestamp: string;
  peakVolume: number;
  avgVolume: number;
  medianVolume: number;
  spikeDurationHours: number;
  surroundingHours: { timestamp: string; count: number }[];
  eventHours: { timestamp: string; count: number }[];
  tweetSamples?: TweetSampleForPrompt[];
}

export function buildTrendExplanationPrompt(
  query: string,
  spike: SpikeContext,
  campaignStartDate?: string,
  campaignEndDate?: string
): string {
  const multiplier = spike.avgVolume > 0 ? (spike.peakVolume / spike.avgVolume).toFixed(1) : 'N/A';
  const medianMultiplier = spike.medianVolume > 0 ? (spike.peakVolume / spike.medianVolume).toFixed(1) : 'N/A';

  const surroundingLines = spike.surroundingHours
    .map((h) => `  ${h.timestamp}: ${h.count} posts/hr${h.count >= spike.peakVolume ? ' ← PEAK' : ''}`)
    .join('\n');

  const eventLines = spike.eventHours
    .map((h) => `  ${h.timestamp}: ${h.count} posts/hr`)
    .join('\n');

  // Build tweet samples section
  let tweetSamplesSection = '';
  if (spike.tweetSamples && spike.tweetSamples.length > 0) {
    const tweetLines = spike.tweetSamples
      .map((t, i) => {
        const engagement = t.retweets != null || t.likes != null
          ? ` [${t.retweets ?? 0} RTs, ${t.likes ?? 0} likes]`
          : '';
        return `  ${i + 1}. (${t.created_at})${engagement}\n     "${t.text}"`;
      })
      .join('\n\n');

    tweetSamplesSection = `

ACTUAL TWEET SAMPLES FROM THIS SPIKE (sorted by relevance):
These are real posts from X during the spike window. Use these to determine what people were ACTUALLY talking about.
${tweetLines}`;
  }

  return `You are an expert on X (Twitter) trends and real-time events. Today's date is ${new Date().toISOString().split('T')[0]}.

The following X search query experienced a significant volume spike. You have been given the ACTUAL hourly volume data AND a sample of REAL TWEETS posted during this spike. Your analysis MUST be grounded in the actual tweet content — do NOT guess or speculate about what caused the spike.

Query: ${query}${campaignStartDate && campaignEndDate ? `\nTargeted Campaign Period: ${campaignStartDate} to ${campaignEndDate}` : ''}

SPIKE SUMMARY:
- Peak Timestamp: ${spike.timestamp}
- Peak Volume: ${spike.peakVolume} posts/hour
- 7-Day Average Volume: ${spike.avgVolume} posts/hour
- 7-Day Median Volume: ${spike.medianVolume} posts/hour
- Spike Magnitude: ${multiplier}x the average, ${medianMultiplier}x the median
- Spike Duration: ${spike.spikeDurationHours} consecutive hour(s) above threshold

HOURS IN THIS SPIKE EVENT (consecutive above-threshold hours):
${eventLines}

SURROUNDING 24-HOUR WINDOW (±12 hours around peak for context):
${surroundingLines}${tweetSamplesSection}

YOUR TASK:
Analyze the actual tweet content above to determine what specifically caused this spike. The tweets ARE your primary evidence — read them carefully and identify the common themes, events, or topics being discussed.

STEP 1 — TWEET CONTENT ANALYSIS (PRIMARY):
${spike.tweetSamples && spike.tweetSamples.length > 0
  ? `Read through the tweet samples provided above and identify:
1. What specific event, news, or topic are people discussing? Look for common themes across multiple tweets.
2. Are people reacting to a live event (game, show, announcement), sharing news, or discussing something viral?
3. What specific details can you extract? (e.g., game scores, show names, announcement details, news headlines)
4. Summarize the ACTUAL conversation in the tweets — do not generalize beyond what the tweets say.`
  : `No tweet samples were available for this spike. Without actual tweet content, your analysis will be limited to timing patterns and general topic knowledge. Be upfront about this limitation.`}

STEP 2 — TIMING PATTERN (SECONDARY):
Use the volume timing pattern to corroborate your tweet content analysis:
1. When did the spike start ramping up? When did it peak? How fast did it decay?
2. Does the timing pattern match the type of event the tweets describe? (live sports = multi-hour ramp + sharp peak, breaking news = sudden spike, etc.)
3. Look at the DAY OF WEEK and TIME OF DAY for additional context.${campaignStartDate && campaignEndDate ? `\n\nThe user's campaign targets ${campaignStartDate} to ${campaignEndDate}. Based on what you found in the tweets, note whether this type of spike is likely to recur during the campaign period.` : ''}

CRITICAL RULES — NEVER GUESS:
- Your explanation MUST be based on what you can actually see in the tweet samples. Quote or reference specific tweets when possible.
- If the tweet samples clearly show a specific event or topic, explain it with high confidence.
- If the tweets are ambiguous or point to multiple possible causes, say so honestly and set confidence to "medium".
- If no tweet samples were available, or the tweets don't reveal a clear cause, say "Unable to determine the specific cause of this spike from the available data" and set confidence to "low". Do NOT invent plausible-sounding events or speculate.
- NEVER fabricate game scores, specific news headlines, or event details.
- NEVER list generic possible causes (like "could be an album release, tour, or award show"). Either you can see it in the tweets or you can't.

Respond ONLY with valid JSON in this exact format:
{
  "explanation": "explanation grounded in the actual tweet content and timing data",
  "keyEvents": ["specific event identified from tweets"],
  "confidence": "high" | "medium" | "low"
}`;
}

export function buildThresholdRecommendationPrompt(
  query: string,
  onThreshold: number,
  offThreshold: number,
  stats: StatsResult,
  hoursAboveOn: number,
  hoursAboveOff: number,
  dataStartDate: string,
  dataEndDate: string,
  campaignStartDate?: string,
  campaignEndDate?: string
): string {
  const totalHours = stats.totalDataPoints;
  const pctAboveOn = totalHours > 0 ? ((hoursAboveOn / totalHours) * 100).toFixed(1) : '0';
  const pctAboveOff = totalHours > 0 ? ((hoursAboveOff / totalHours) * 100).toFixed(1) : '0';
  const onOffGapPct = onThreshold > 0 ? (((onThreshold - offThreshold) / onThreshold) * 100).toFixed(0) : '0';

  const dowLines = Object.entries(stats.dayOfWeekAvg)
    .map(([day, avg]) => `  ${day}: ${avg} posts/hour`)
    .join('\n');

  const hourEntries = Object.entries(stats.hourOfDayAvg).sort((a, b) => b[1] - a[1]);
  const peakHourLines = hourEntries.slice(0, 6).map(([h, avg]) => `  ${h}:00 UTC: ${avg}`).join('\n');
  const quietHourLines = hourEntries.slice(-6).map(([h, avg]) => `  ${h}:00 UTC: ${avg}`).join('\n');

  return `You are an expert Advertising Trigger System analyst for X (Twitter) Trend Genius campaigns. Today's date is ${new Date().toISOString().split('T')[0]}.

A user wants to evaluate whether their ON/OFF thresholds are well-calibrated for the following query. You have been given 7 days of ACTUAL hourly volume statistics from X. Base your recommendation ENTIRELY on this data.

Query: ${query}
Current ON Threshold: ${onThreshold} posts/hour
Current OFF Threshold: ${offThreshold} posts/hour
Data Window (last 7 days): ${dataStartDate} to ${dataEndDate}${campaignStartDate && campaignEndDate ? `\nTargeted Campaign Period: ${campaignStartDate} to ${campaignEndDate}` : '\nTargeted Campaign Period: Not specified'}

EXACT THRESHOLD HIT COUNTS (computed from raw data — these are facts, not estimates):
- Hours above ON threshold (${onThreshold}): ${hoursAboveOn} out of ${totalHours} hours (${pctAboveOn}%)
- Hours above OFF threshold (${offThreshold}): ${hoursAboveOff} out of ${totalHours} hours (${pctAboveOff}%)
- ON-OFF gap: ${onOffGapPct}%

7-DAY HOURLY VOLUME STATISTICS (${stats.totalDaysInData} days, ${stats.totalDataPoints} hours of data):
- Mean: ${stats.mean} posts/hour
- Median: ${stats.median} posts/hour
- Standard Deviation: ${stats.stdDev}
- Min: ${stats.min} posts/hour
- Max: ${stats.max} posts/hour
- 25th percentile (P25): ${stats.p25} posts/hour
- 75th percentile (P75): ${stats.p75} posts/hour
- 90th percentile (P90): ${stats.p90} posts/hour
- 95th percentile (P95): ${stats.p95} posts/hour
- 99th percentile (P99): ${stats.p99} posts/hour
- Quiet hours (below 25% of mean): ${stats.quietHourPct}%

Day-of-Week Average Volume:
${dowLines}

Peak Hours (UTC, top 6):
${peakHourLines}
Quietest Hours (UTC, bottom 6):
${quietHourLines}

Spike Analysis (spikes = contiguous periods above P90):
- Distinct spike events: ${stats.spikeCount}
- Average spike duration: ${stats.avgSpikeDurationHours} hours
- Calendar days with spike activity: ${stats.spikeDays} out of ${stats.totalDaysInData} days

STEP 1 — TOPIC & TIMING ANALYSIS (CRITICAL — DO THIS FIRST):
Before evaluating thresholds, analyze the query topic to determine whether the 7-day data window (${dataStartDate} to ${dataEndDate}) is representative of the volume the campaign will actually see.

Many topics have MULTIPLE conversation drivers that operate on different cycles. Do NOT force a single label — instead, identify ALL relevant patterns and determine which one(s) are active in this data window.

Examples of multi-pattern topics:
- "Messi" → (1) MLS regular season games (seasonal, Feb–Oct), (2) World Cup (event-driven, every 4 years), (3) Copa America (event-driven), (4) endorsement deals / personal life / viral moments (evergreen baseline). If the data window is April, MLS is in-season so this data captures game-day spikes and is representative for an MLS-focused campaign. But if the campaign targets World Cup Messi conversation, this data is NOT representative.
- "LeBron James" → (1) NBA season (seasonal, Oct–Jun), (2) off-court business / media / cultural moments (evergreen). April data captures playoff-season volume — great for NBA campaigns, but the evergreen baseline may differ in the offseason.
- "Taylor Swift" → (1) tour dates (event-driven), (2) album releases (event-driven), (3) general celebrity conversation (evergreen). Data representativeness depends on whether a tour or release is happening in this window.

For your analysis, answer these questions:
1. What are the topic's conversation drivers? List them with their cycle type (seasonal/event-driven/evergreen).
2. Which driver(s) are ACTIVE during the data window (${dataStartDate} to ${dataEndDate})?
3. ${campaignStartDate && campaignEndDate
    ? `The user's campaign runs ${campaignStartDate} to ${campaignEndDate}. Compare this to the data window. Are the same drivers active during both periods? If the campaign targets a different season or event than what the data window captures (e.g., data is from the offseason but the campaign runs during the active season), the thresholds calibrated from this data will be WRONG. Be explicit about this mismatch.`
    : `No campaign dates were provided. Assess whether the data window reflects a "normal", "elevated", or "quiet" period for this topic, and note which campaign timing would make these thresholds appropriate vs. inappropriate.`}
4. If the data window and campaign period have a seasonal mismatch, do NOT just recommend "lower" or "raise" based on current data — instead warn that the data is not representative and explain what volume range the user should expect during their campaign period.

Use the actual volume data to corroborate your assessment — if you think this should be an active period but the mean is very low, or you think it's offseason but there are clear spikes, say so and reconcile the discrepancy.

STEP 2 — THRESHOLD EVALUATION (using the data + topic context):
1. Use the EXACT hours-above-ON count (${hoursAboveOn}/${totalHours} = ${pctAboveOn}%) as the primary signal. Do NOT recalculate this — it is computed from raw data.
   - >15% of hours above ON → TOO LOW. Trigger fires too often. Recommend raising.
   - 5-10% of hours above ON → GOOD RANGE for genuine spikes.
   - 2-5% → Aggressive but valid — only catches the biggest spikes.
   - <1% and Max > ON → Tight calibration, acceptable if they want only extreme spikes.
   - 0% and ON > Max (${stats.max}) → TOO HIGH. Trigger can never fire on recent data. IF the topic is seasonal/event-driven and data window is offseason, say so rather than just recommending "lower". IF the topic is evergreen and the threshold is above the max, then recommend lowering.

2. Compare ON to the percentile distribution to give context:
   - Where does ON (${onThreshold}) fall? Below P75 (${stats.p75})? Between P90 (${stats.p90}) and P95 (${stats.p95})? Above P99 (${stats.p99})?
   - The ideal range is typically P90–P95 for most campaigns.

3. Check the OFF threshold:
   - OFF should be 25-40% below ON for proper hysteresis.
   - Current gap is ${onOffGapPct}%. If <15%, warn about rapid cycling.
   - OFF should be above the median (${stats.median}) to avoid staying "on" during normal volume.

4. If recommending a change, suggest SPECIFIC threshold values derived from the percentiles, rounded to clean numbers.

STEP 3 — DATA REPRESENTATIVENESS CAVEAT:
Based on your topic analysis in Step 1, assess whether these thresholds will hold up during the actual campaign:
${campaignStartDate && campaignEndDate
    ? `The campaign runs ${campaignStartDate} to ${campaignEndDate}. Your assessment MUST compare the data window to the campaign period:
- If both periods fall in the SAME seasonal context (e.g., both during NFL season): confidence "high" — the data is representative.
- If the data window is OFFSEASON but the campaign runs during the ACTIVE season: confidence "low". Do NOT recommend threshold changes based on offseason data. Instead, warn: "These thresholds are calibrated against offseason data (${dataStartDate} to ${dataEndDate}), but your campaign runs during [active period] when volume will be significantly higher. Re-run this analysis during the active season or use the Campaign Setup wizard with historical seasonal data."
- If the data window is ACTIVE season but the campaign runs in the OFFSEASON: warn that campaign volume will be lower and thresholds may need to be lowered.
- If transitional (e.g., data from preseason, campaign spans full season): confidence "medium", note that thresholds may need adjustment as the season progresses.`
    : `No campaign dates specified. State whether the current data window appears to be an active, quiet, or transitional period for this topic, so the user can decide if these thresholds are appropriate for their intended campaign timing.`}
- If the topic has multiple drivers, assess which driver the campaign period aligns with and evaluate accordingly.

DETERMINISM & ACCURACY (CRITICAL):
- Every number you cite must come from the statistics above. Do NOT invent or approximate values.
- Use the exact hoursAboveOn count (${hoursAboveOn}) — do not recalculate it.
- Your recommendation must be fully explainable from the data — no subjective opinions without data backing.

Respond ONLY with valid JSON in this exact format:
{
  "action": "raise" | "lower" | "keep",
  "reasoning": "detailed explanation that starts with topic classification, then references specific data points, percentiles, and exact threshold hit counts",
  "suggestedOnThreshold": <number or null if keeping>,
  "suggestedOffThreshold": <number or null if keeping>,
  "onThresholdPercentile": "approximately what percentile the current ON threshold falls at",
  "hoursAboveOnPct": "${pctAboveOn}%",
  "confidence": "high" | "medium" | "low"
}`;
}
