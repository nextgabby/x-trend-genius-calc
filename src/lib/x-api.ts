import type { HourlyDataPoint, CountsResponse } from './types';

const X_API_COUNTS_URL = 'https://api.twitter.com/2/tweets/counts/all';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchTweetCounts(
  query: string,
  startTime: string,
  endTime: string
): Promise<CountsResponse> {
  const bearerToken = process.env.X_API_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error('X_API_BEARER_TOKEN environment variable is not set');
  }

  console.log(`[X API] Fetching counts — query: "${query}"`);
  console.log(`[X API] Period: ${startTime} → ${endTime}`);

  const allData: HourlyDataPoint[] = [];
  let nextToken: string | undefined;
  let totalTweets = 0;
  let pageCount = 0;

  do {
    const params = new URLSearchParams({
      query,
      granularity: 'hour',
      start_time: startTime,
      end_time: endTime,
    });

    if (nextToken) {
      params.set('next_token', nextToken);
    }

    const url = `${X_API_COUNTS_URL}?${params.toString()}`;
    pageCount++;
    console.log(`[X API] Page ${pageCount}${nextToken ? ` (next_token: ${nextToken.substring(0, 20)}...)` : ''}`);
    let response: Response | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      if (response.status === 429) {
        if (attempt === MAX_RETRIES) {
          throw new Error('X API rate limit exceeded after max retries');
        }
        const retryAfter = response.headers.get('retry-after');
        const backoffMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : INITIAL_BACKOFF_MS * 2 ** attempt;
        await sleep(backoffMs);
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`X API error ${response.status}: ${errorBody}`);
      }

      break;
    }

    if (!response || !response.ok) {
      throw new Error('Failed to fetch counts from X API');
    }

    const data = await response.json();

    if (data.data && Array.isArray(data.data)) {
      for (const bucket of data.data) {
        allData.push({
          timestamp: bucket.start,
          count: bucket.tweet_count,
        });
        totalTweets += bucket.tweet_count;
      }
    }

    nextToken = data.meta?.next_token;
  } while (nextToken);

  // Sort by timestamp
  allData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log(`[X API] Done — ${pageCount} pages, ${allData.length} hourly data points, ${totalTweets.toLocaleString()} total tweets`);

  return {
    data: allData,
    totalTweets,
    startTime,
    endTime,
  };
}
