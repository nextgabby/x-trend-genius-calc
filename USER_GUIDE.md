# Trend Genius Calculator — User Guide

## What Is This Tool?

The Trend Genius Calculator helps you configure **Trend Genius ad triggers** on X (formerly Twitter). It figures out the right volume thresholds for your campaign so your ads only run when a topic is genuinely trending — not during normal conversation levels.

The tool uses real post volume data from X and AI analysis from Grok to recommend when your ads should turn on and off based on conversation spikes.

---

## Two Modes

When you open the tool, you'll see two tabs at the top:

### Campaign Setup
A step-by-step wizard that takes you from scratch to a fully configured trigger. Use this when you're setting up a **new campaign**.

### Threshold Analysis
A standalone tool for testing existing thresholds against recent data. Use this when you already have thresholds and want to **validate or adjust** them.

---

## Campaign Setup (The Wizard)

The wizard walks you through 5 steps:

### Step 1 — Details

Enter your campaign information:

- **X Handle** — The advertiser's handle (e.g., `@Nike`). This helps Grok understand the brand's audience and tone when building the search query. The handle itself won't be included in the search query.
- **Campaign Start / End** — When your campaign runs. This affects how the tool looks at historical data — a summer campaign will pull different comparison data than a winter one.
- **Keywords / Topics** — The topics you want to track (e.g., `NFL, football, Super Bowl`). Separate multiple keywords with commas.
- **Keyword Mode** — Two options:
  - **Let Grok optimize** — Grok expands your keywords with hashtags, variations, abbreviations, and related terms to cast a wide net. Best for most campaigns.
  - **Use exact keywords** — Uses your keywords as-is with no additions. Use this when you have client-approved terms that can't be changed.
- **Total Ad Spend Budget** — Your total campaign budget in USD. This is used to calculate daily spend recommendations.

### Step 2 — Keywords

Grok analyzes your keywords and produces:

- **Search Query** — The actual X search query that will be used as your live trigger. You can edit this before proceeding.
- **Seasonality Classification** — Grok determines if your topic is:
  - **Seasonal** — Follows a predictable annual cycle (e.g., NFL, Christmas shopping). Historical data is pulled from the same time window last year.
  - **Non-seasonal / Evergreen** — Volume is relatively consistent year-round (e.g., a celebrity, a brand). Historical data is pulled from the most recent period.
  - **Event-driven** — Tied to a specific event (e.g., World Cup 2026, Met Gala). Historical data is pulled from the last occurrence of that event.
- **Historical Lookback Period** — The date range Grok recommends for pulling comparison data. You can override this if you know better.
- **Lookback Query** (sometimes) — If the historical period needs different search terms than the live campaign (e.g., searching for "Qatar 2022" data to predict "USA 2026" volume), Grok creates a separate lookback query. This only appears when needed.

**You can override anything on this screen.** If Grok gets the seasonality wrong, change it. If you want different lookback dates, edit them. If you want to tweak the query, go ahead. Hit "Re-analyze with Grok" to have Grok regenerate with your overrides applied.

### Step 3 — Data

The tool fetches real hourly post volume data from X for your query over the lookback period. You'll see:

- **Hours Collected** — How many hourly data points were retrieved.
- **Total Post Volume** — The total number of posts matching your query across the entire lookback period.
- **Period** — The actual date range of the data.
- **Volume Chart** — A visual chart of hourly post volume over time.

If a separate lookback query was used, both the lookback query (used for historical data) and the campaign trigger query (used live) are shown so you can verify them.

This step is automatic — just review the data and click "Calculate Thresholds" to proceed.

### Step 4 — Thresholds

Grok analyzes the historical volume data and recommends trigger thresholds:

- **ON Threshold** — The post volume (posts per hour) that must be reached for your ads to turn on. This targets genuine spikes — typically the top 5-10% of hours.
- **OFF Threshold** — The post volume at which your ads turn back off. This is set lower than ON to prevent rapid on/off cycling (called "hysteresis").
- **Consecutive Hours** — How many hours in a row volume must stay above the ON threshold before the trigger fires. This prevents false triggers from brief noise.

**You can edit all three values** by clicking on the numbers. When you change a threshold:
- The budget calculations update automatically.
- A note appears showing Grok's original recommendation.
- You can click "Reset to Grok" to revert your changes.

You'll also see:

- **Total Budget** — Your campaign budget (from Step 1).
- **Est. Trend Days** — How many days the trigger is expected to fire during your campaign, based on historical spike frequency.
- **Max Daily Spend** — Your budget divided by estimated trend days — the recommended daily cap.
- **Volume Chart** — The historical data with your ON and OFF threshold lines overlaid.
- **Reasoning** — Grok's explanation of how it chose the thresholds.
- **Budget Allocation** — Grok's explanation of the spend recommendation.
- **Peak Hours** — Typical times when volume is highest.

### Step 5 — Results

The final configuration summary with everything in one place:

- Campaign details, search query, thresholds, budget, volume stats, analysis, and peak hours.
- If you modified thresholds from Grok's recommendation, the original values are shown for reference.

**Export options:**
- **Copy to Clipboard** — Copies a formatted plain-text summary to your clipboard. Paste it into Slack, email, a doc, etc.
- **Download as Word Doc** — Downloads a formatted .docx file with all configuration details organized into sections.
- **Export Data CSV** — Downloads the raw hourly volume data as a CSV file for further analysis.
- **Start Over** — Resets the wizard to start a new campaign.

---

## Threshold Analysis (Standalone Tool)

Use this when you already have thresholds and want to test them against recent real-world data.

### Inputs

- **Search Query** — The X search query to test (paste your existing trigger query).
- **Campaign Start / End** — When your campaign runs. This is important because Grok uses it to determine if the test data is representative. For example, testing an NFL query in April will show offseason data — Grok will warn you that these thresholds won't apply during the regular season.
- **ON Threshold** — Your current ON threshold (posts/hour).
- **OFF Threshold** — Your current OFF threshold (posts/hour).

### What You Get

After clicking "Analyze," the tool fetches the last 7 days of real data from X and shows:

**Volume Chart** — Your query's hourly volume over the past 7 days with ON/OFF threshold lines overlaid. This gives you an immediate visual of how often your thresholds would trigger.

**Recommendation** — Grok analyzes the data and recommends whether to raise, lower, or keep your thresholds. This is not a generic suggestion — Grok:
- Computes exact statistics (mean, median, percentiles, spike counts) from the raw data
- Identifies what kind of topic you're tracking (evergreen celebrity, seasonal sport, event-driven, etc.)
- Compares the 7-day test window to your campaign dates to check if the data is representative
- If there's a mismatch (e.g., offseason data for an in-season campaign), Grok flags it and explains what to expect during the actual campaign

If Grok suggests new thresholds, the specific recommended values are shown.

**Daily Breakdown** — A table showing each day's average volume, peak volume, and how many hours exceeded the ON threshold. Useful for spotting patterns (e.g., weekday vs. weekend).

**Threshold Hits** — Each time the ON threshold was exceeded, grouped into distinct events. For each event you see:
- When it happened (timestamp)
- Peak volume during the event
- How long the event lasted (consecutive hours above threshold)
- An **"Explain with Grok"** button — click this to have Grok analyze what caused the spike

### Spike Explanations

When you click "Explain with Grok" on a threshold hit, Grok receives:
- The full hour-by-hour volume data during the spike
- A 24-hour window of surrounding data (before and after)
- Your query keywords and campaign dates

Grok then identifies the most likely real-world cause — a game, a news event, a viral moment, a show premiere, etc. It considers the topic type (is this a regular game-day spike for an athlete, or an unusual viral moment for a celebrity?) and tells you whether to expect similar spikes during your campaign.

Each explanation includes a confidence level:
- **High** — Grok is confident about the cause (e.g., a well-known scheduled game)
- **Medium** — The timing and keywords suggest a likely cause but Grok isn't 100% certain
- **Low** — Grok is unsure and says so honestly rather than guessing

---

## Key Concepts

### What is a "threshold"?
A threshold is a volume level (posts per hour) that triggers an action. When conversation volume crosses above the ON threshold, your ads start running. When it drops below the OFF threshold, they stop.

### Why are ON and OFF different?
If ON and OFF were the same number, your ads would rapidly flicker on and off as volume bounces around that level. The gap between them (called hysteresis) prevents this — volume has to clearly spike above ON to start, and clearly drop below OFF to stop.

### What is "Consecutive Hours"?
A safety filter. Instead of triggering the moment volume crosses the ON threshold (which could be a brief noise spike), the system waits for volume to stay above ON for this many hours in a row before activating. This ensures you only trigger on sustained spikes.

### What does "confidence" mean?
Grok rates its own confidence in its recommendations:
- **High** — Plenty of data, clear patterns, strong statistical basis
- **Medium** — Adequate data but some uncertainty (limited data points, unusual patterns)
- **Low** — Limited data or the data may not be representative (e.g., offseason window for a seasonal topic)

### Seasonal vs. Evergreen vs. Event-Driven — why does it matter?
This determines what historical data the tool uses as a comparison baseline:
- **Seasonal** topics (NFL, NBA, holiday shopping) have predictable annual cycles. The tool pulls data from the same time last year because that's the best predictor.
- **Evergreen** topics (celebrities, brands) are relatively steady year-round. The tool pulls the most recent data.
- **Event-driven** topics (World Cup, Super Bowl) spike around specific events. The tool pulls data from the last occurrence of that event.

Getting this right is critical — using offseason data to set thresholds for an in-season campaign would result in thresholds that are far too low.

---

## Tips

- **Start with "Let Grok optimize"** for keywords unless you have client-approved terms. Grok catches variations and hashtags you might miss.
- **Review the search query** in Step 2 carefully. This is what determines which conversations trigger your ads. Make sure it's specific enough to avoid false positives but broad enough to catch the conversation you want.
- **Check the seasonality classification.** If Grok says "non-seasonal" but your topic is clearly seasonal (or vice versa), override it. This significantly affects which historical data is used.
- **Use the Threshold Analysis tab** to validate thresholds before or during a live campaign. It only takes a minute to check if your thresholds are still well-calibrated.
- **Always enter campaign dates** in the Threshold Analysis tab. Without them, Grok can't tell you if the 7-day test data is representative of what your campaign will actually see.
- **Don't panic about low confidence** — it usually just means Grok is being honest that the data window may not be representative. It's a signal to re-test later, not that something is broken.
- **Use "Explain with Grok"** on threshold hits to understand what's driving spikes. This helps you decide if the spikes are the kind of moments you want your ads to run during, or noise you want to filter out.
