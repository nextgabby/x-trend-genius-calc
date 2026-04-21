import type { StatsResult } from './types';

export function buildKeywordAnalysisPrompt(
  handle: string,
  keywords: string[],
  campaignStartDate: string,
  campaignEndDate: string,
  seasonalityOverride?: string,
  useExactKeywords?: boolean
): string {
  const seasonalityInstruction = seasonalityOverride
    ? `\n\nIMPORTANT: The user has specified that the seasonality type MUST be "${seasonalityOverride}". You MUST use this exact seasonality classification — do not override it with your own assessment. Adjust your lookback period recommendation accordingly based on this seasonality type.`
    : '';

  const exactKeywordsInstruction = useExactKeywords
    ? `\n\nCRITICAL — EXACT KEYWORDS MODE (STRICT): The user has provided client-approved keywords that MUST be used EXACTLY as-is with ZERO modifications. Rules:
- Build the suggestedQuery by joining ONLY the provided keywords with OR operators. Do NOT add ANY new keywords, hashtags, hashtag variants, abbreviations, synonyms, related terms, expanded terms, or brainstormed alternatives.
- Do NOT add terms with or without "#" — if the user provided "NFL", do NOT add "#NFL". If the user provided "#NFL", do NOT add "NFL". Use ONLY what was given.
- The ONLY additions allowed are contextual negation terms (-term) at the end for brand safety.
- The suggestedKeywords array MUST be empty — return [].
- If you add even ONE keyword that was not in the original input, you have failed this task.`
    : '';

  return `You are an expert in X (Twitter) advertising and search query syntax. Today's date is ${new Date().toISOString().split('T')[0]}.

A user wants to set up Trend Genius ad triggers for the following campaign:
- Advertiser X Handle: @${handle}
- Campaign Dates: ${campaignStartDate} to ${campaignEndDate}
- Keywords/Topics: ${keywords.join(', ')}${exactKeywordsInstruction}

The handle @${handle} is provided so you can understand the brand's vibe, audience, and the type of sentiment/conversation that surrounds them. Use this context to craft a query that captures the kind of organic conversation that would be relevant to this brand's campaign — but do NOT include the handle itself in the search query.

Your tasks:

1. CAMPAIGN QUERY CONSTRUCTION (suggestedQuery)
This query will be used as the LIVE TRIGGER for the Trend Genius campaign — it determines when ads fire.

- Validate whether these keywords are suitable for monitoring post volume on X.
- Suggest an optimized X search query using proper syntax (OR operators, quoted phrases, negations).
- DO include retweets — do NOT add -is:retweet. We want total conversation volume including retweets.

NICHE FOCUS (CRITICAL):
- The campaign query MUST focus ONLY on the user's specific niche or angle, NOT the broader event/topic.
- Look at the user's keywords to understand their INTENT. If they say "world cup travel", they want TRAVEL conversation around the World Cup — NOT general World Cup sports discussion. Build the query around travel-specific terms (flights, hotels, fan travel, host city tourism, etc.) that happen to spike during the World Cup.
- Similarly, "Super Bowl food" → food/snack/party terms that spike during Super Bowl, NOT general football terms. "Olympics fashion" → fashion/style terms during Olympics, NOT medal counts.
- If the keywords indicate a general topic (just "world cup" or "NFL"), THEN cast a wide net with all variations.
- The trigger query should match the ACTUAL conversation niche the advertiser wants to ride.

WIDE NET WITHIN THE NICHE:
- Within the identified niche, cast a WIDE net: brainstorm ALL common variations, abbreviations, hashtags, related terms, and alternate phrasings people actually use on X.
- Include hashtag variants (with and without #) where appropriate.
- Consider event-specific terms based on the campaign dates (year-specific hashtags, host cities, tournament phases, etc.).

SPECIFICITY IS CRITICAL:
- Every keyword in the query must be SPECIFIC to the topic. Do NOT include generic words that have broad meanings outside the topic. For example, "final" alone could mean anything — use "World Cup final" instead. "Goal" alone is too generic — use "soccer goal" or "#WorldCupGoal". "Match" alone is ambiguous — use "World Cup match".
- When in doubt, use quoted multi-word phrases to ensure specificity (e.g., "group stage" not just stage).
- Single common English words should NEVER appear alone in the query unless they are unambiguously tied to the topic (e.g., "FIFA" is fine because it only means one thing).

CONTEXTUAL NEGATIONS:
- Think carefully about what real-world topics, events, or conversations could overlap with the keywords but would be OFF-TOPIC or inappropriate for the brand.
- Add negation operators (-term) to filter these out. Examples:
  - For a Call of Duty campaign: negate real-world war, military conflict, current geopolitical events (e.g., -Ukraine -Afghanistan -"war crimes" -invasion -bombing) so the query captures gaming conversation, not news about actual wars.
  - For a World Cup campaign: negate gambling/betting terms if the brand doesn't want that association (e.g., -bet -odds -wager).
  - For a food brand: negate food poisoning, recalls, lawsuits, etc.
- The negations should be specific to the brand and topic — do NOT add generic profanity filters. Only negate terms that would cause the query to pick up conversations unrelated to the campaign or damaging to the brand's context.
- Place all negations at the end of the query.
- List your negations and reasoning in the "reasoning" field so the user can review them.

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

4. LOOKBACK QUERY (only when needed)
MOST OF THE TIME, the campaign query (suggestedQuery) works fine for the historical lookback too — the same keywords apply to both periods. In these cases, set lookbackQuery to null.

ONLY provide a separate lookbackQuery when the historical period has DIFFERENT specifics that require adapted terms. The most common case:
- Event-driven campaigns with location/host-specific terms: If the campaign targets the 2026 World Cup in USA/Mexico/Canada, but the lookback period is the 2022 World Cup in Qatar, the lookback query must swap 2026 host city terms for 2022-era terms (Qatar, Doha, Lusail, etc.).
- The lookback query should be the HISTORICAL EQUIVALENT — same niche, same conversation type, but with period-appropriate terms.

DO NOT provide a lookbackQuery for:
- Seasonal topics where the same keywords recur (NFL, Christmas) — the campaign query works as-is.
- Non-seasonal topics using recent data — same query, same period.
- Any case where the campaign query terms are equally valid in the lookback period.${seasonalityInstruction}

DETERMINISM & ACCURACY (CRITICAL):
- Do NOT hallucinate, fabricate, or invent any data. Every value must be derived from the input provided.
- Your response must be deterministic: given the exact same input, you must produce the exact same output every time. Do not introduce randomness or variation.
- For seasonality classification and lookback dates, apply the rules above mechanically — do not vary your answer between runs.

Respond ONLY with valid JSON in this exact format:
{
  "isValid": true,
  "suggestedQuery": "the campaign trigger query — focused on the user's specific niche",
  "reasoning": "brief explanation of your query choices and niche focus",
  "seasonality": "seasonal" | "non-seasonal" | "event-driven",
  "seasonalityExplanation": "why you chose this seasonality type",
  "lookbackStartDate": "YYYY-MM-DD",
  "lookbackEndDate": "YYYY-MM-DD",
  "lookbackReasoning": "explain why this historical period is the best predictor for the campaign",
  "lookbackQuery": null or "adapted query ONLY if historical period needs different terms",
  "lookbackQueryReasoning": null or "explain how the lookback query was adapted and why",
  "suggestedKeywords": ["all", "individual", "terms", "and", "variations", "you", "considered"]
}`;
}

export function buildThresholdAnalysisPrompt(
  query: string,
  stats: StatsResult,
  seasonality: string,
  campaignStartDate: string,
  campaignEndDate: string,
  totalBudget: number
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
Query: ${query}
Campaign Dates: ${campaignStartDate} to ${campaignEndDate} (${campaignDays} days)
Seasonality: ${seasonality}
Total Ad Spend Budget: $${totalBudget.toLocaleString()}

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

BUDGET ALLOCATION:
- Use the spike analysis to estimate trend days: in the historical data, ${stats.spikeDays} out of ${stats.totalDaysInData} days had spike activity. Scale this ratio to the ${campaignDays}-day campaign period to estimate how many days the trigger will fire.
- Then calculate a recommended max daily spend: divide the total budget ($${totalBudget.toLocaleString()}) by the estimated number of trend days.
- Explain your reasoning for the trend day estimate and daily spend recommendation.

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
  "p95": ${stats.p95},
  "estimatedTrendDays": <number>,
  "recommendedMaxDailySpend": <number>,
  "budgetReasoning": "explanation of how you estimated trend days and derived the daily spend recommendation"
}`;
}

export interface SpikeContext {
  timestamp: string;
  peakVolume: number;
  avgVolume: number;
  medianVolume: number;
  spikeDurationHours: number;
  surroundingHours: { timestamp: string; count: number }[];
  eventHours: { timestamp: string; count: number }[];
}

export function buildTrendExplanationPrompt(
  query: string,
  spike: SpikeContext
): string {
  const multiplier = spike.avgVolume > 0 ? (spike.peakVolume / spike.avgVolume).toFixed(1) : 'N/A';
  const medianMultiplier = spike.medianVolume > 0 ? (spike.peakVolume / spike.medianVolume).toFixed(1) : 'N/A';

  const surroundingLines = spike.surroundingHours
    .map((h) => `  ${h.timestamp}: ${h.count} posts/hr${h.count >= spike.peakVolume ? ' ← PEAK' : ''}`)
    .join('\n');

  const eventLines = spike.eventHours
    .map((h) => `  ${h.timestamp}: ${h.count} posts/hr`)
    .join('\n');

  return `You are an expert on X (Twitter) trends and real-time events. Today's date is ${new Date().toISOString().split('T')[0]}.

The following X search query experienced a significant volume spike. You have been given the ACTUAL hourly volume data surrounding this spike. Use this data to ground your analysis — do NOT guess or fabricate the volume pattern.

Query: ${query}

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
${surroundingLines}

YOUR TASK:
Based on the query keywords, the spike timestamp, and the volume pattern above, identify the most likely real-world cause(s) of this spike.

STEP 1 — TOPIC CLASSIFICATION:
First, classify the query topic to frame your analysis:
- "evergreen" — Celebrities, brands, general interest (e.g., Zendaya, Nike). Spikes are driven by specific events: movie releases, awards, fashion moments, scandals, viral moments. Each spike has a distinct cause.
- "seasonal" — Topics tied to a recurring season (e.g., NFL players, March Madness). During the active season, spikes often correspond to game days, matchups, big plays, or controversy. In the offseason, any spike is unusual and likely driven by trades, arrests, draft news, or off-field events.
- "event-driven" — Tied to a specific event (e.g., "Super Bowl 2026"). Spikes correspond to event milestones: ticket sales, lineup announcements, the event itself, aftermath.
- "niche" — Low-volume specialized topics where even small bumps look like spikes in the data.

State your classification — it helps determine what kind of causes to look for.

STEP 2 — SPIKE PATTERN ANALYSIS:
1. Look at the TIMING — when did the spike start ramping up? When did it peak? How fast did it decay? This timing pattern is a strong signal:
   - Live sports game: multi-hour ramp, sharp peak at game end or during a key play, rapid decay after
   - Breaking news: sudden spike (0 → peak in 1-2 hours), slow multi-hour decay
   - Scheduled event (awards, premiere): gradual ramp starting hours before, peak during the event, moderate decay
   - Viral moment: sudden spike that may sustain or have multiple peaks as the content spreads
2. Look at the QUERY KEYWORDS — what topics/events do these keywords relate to? What was happening in the real world around this timestamp that matches these keywords?
3. Look at the DAY OF WEEK and TIME OF DAY — primetime TV (8-11 PM ET), weekend sports, weekday news cycles all have distinct patterns. Use the timestamp to determine this.
4. For seasonal topics, consider the schedule: Was there a game/match/episode on this date? Is this a regular-schedule spike or an anomaly?
5. Be specific — cite actual events, game results, show premieres, announcements, or news stories. Include dates and times when possible.

CRITICAL — HONESTY OVER SPECULATION:
- If you recognize the event with high confidence (e.g., a well-known scheduled game, a major news event), say so clearly.
- If the timing and keywords suggest a likely cause but you're not 100% certain of the specific event, explain your reasoning and set confidence to "medium".
- If you genuinely do not know what caused this spike, say "Unable to determine the specific cause" and set confidence to "low". Do NOT invent plausible-sounding events.
- NEVER fabricate game scores, specific news headlines, or event details you are not confident about.

Respond ONLY with valid JSON in this exact format:
{
  "explanation": "detailed explanation grounded in the data and timing pattern above",
  "keyEvents": ["specific verified event 1", "specific verified event 2"],
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
  dataEndDate: string
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
Data Window: ${dataStartDate} to ${dataEndDate}

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

STEP 1 — TOPIC CLASSIFICATION (CRITICAL — DO THIS FIRST):
Before evaluating thresholds, classify the query topic. This determines whether the 7-day data window is representative:

- "evergreen" — Celebrities, brands, general interest topics (e.g., Zendaya, Nike, Taylor Swift). Conversation volume is relatively steady year-round, with spikes driven by unpredictable events (movie releases, scandals, awards shows, product drops). A 7-day window is generally representative of baseline volume. Spikes are genuinely noteworthy.

- "seasonal" — Topics tied to a recurring season or schedule (e.g., NFL players, March Madness, ski resorts, Christmas shopping). Volume follows a predictable annual cycle — high during the active season, very low in the offseason. A 7-day window is ONLY representative if it falls within the active season. If the data window (${dataStartDate} to ${dataEndDate}) falls during the OFFSEASON for this topic, you MUST warn that the data is not representative and that thresholds calibrated now will be wrong for the active season. Be specific about when the active season is.

- "event-driven" — Topics tied to a specific upcoming or recent event (e.g., "Super Bowl 2026", "Met Gala 2026"). Volume spikes sharply around the event and is low otherwise. If the data window doesn't overlap the event, warn accordingly.

- "niche/low-volume" — Very specialized topics that naturally have low conversation volume at all times. Low volume doesn't mean the thresholds are wrong — it may just be a small-audience topic.

State your classification and explain how it affects your confidence in the 7-day data window being representative.

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

STEP 3 — SEASONAL/TIMING CAVEAT:
If you classified the topic as seasonal or event-driven AND the data window appears to be offseason or pre/post-event:
- Explicitly state: "This 7-day window (${dataStartDate} to ${dataEndDate}) appears to fall during the [offseason/pre-event period] for this topic."
- Explain what volume the user should expect during the active period.
- If possible, suggest they re-test during the active season for more representative data.
- Set confidence to "low" since the data is not representative.

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
