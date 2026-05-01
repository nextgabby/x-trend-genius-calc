import type { HourlyDataPoint, CountsResponse } from './types';

const X_API_COUNTS_URL = 'https://api.twitter.com/2/tweets/counts/all';
const X_API_SEARCH_URL = 'https://api.twitter.com/2/tweets/search/all';
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

export interface TweetSample {
  text: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
}

/**
 * Fetches a sample of actual tweets matching the query during a time window.
 * Uses the full-archive search endpoint to get tweet text for spike analysis.
 */
export async function fetchTweetSamples(
  query: string,
  startTime: string,
  endTime: string,
  maxResults: number = 50
): Promise<TweetSample[]> {
  const bearerToken = process.env.X_API_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error('X_API_BEARER_TOKEN environment variable is not set');
  }

  console.log(`[X API] Fetching tweet samples — query: "${query}"`);
  console.log(`[X API] Window: ${startTime} → ${endTime}, max: ${maxResults}`);

  const params = new URLSearchParams({
    query,
    start_time: startTime,
    end_time: endTime,
    max_results: String(Math.min(maxResults, 100)),
    'tweet.fields': 'created_at,public_metrics',
    sort_order: 'relevancy',
  });

  const url = `${X_API_SEARCH_URL}?${params.toString()}`;
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
      throw new Error(`X API search error ${response.status}: ${errorBody}`);
    }

    break;
  }

  if (!response || !response.ok) {
    throw new Error('Failed to fetch tweet samples from X API');
  }

  const data = await response.json();
  const tweets: TweetSample[] = [];

  if (data.data && Array.isArray(data.data)) {
    for (const tweet of data.data) {
      tweets.push({
        text: tweet.text,
        created_at: tweet.created_at,
        public_metrics: tweet.public_metrics,
      });
    }
  }

  console.log(`[X API] Fetched ${tweets.length} tweet samples`);
  return tweets;
}
