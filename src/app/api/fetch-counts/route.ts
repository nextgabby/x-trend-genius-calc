import { NextResponse } from 'next/server';
import { fetchTweetCounts } from '@/lib/x-api';
import { subMinutes } from 'date-fns';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, lookbackStartDate, lookbackEndDate } = body;

    if (!query || !lookbackStartDate || !lookbackEndDate) {
      return NextResponse.json(
        { error: 'Missing required fields: query, lookbackStartDate, lookbackEndDate' },
        { status: 400 }
      );
    }

    console.log(`\n=== /api/fetch-counts ===`);
    console.log(`[Input] query: "${query.substring(0, 80)}...", lookback: ${lookbackStartDate} → ${lookbackEndDate}`);

    const startTime = new Date(lookbackStartDate).toISOString();

    // Ensure end_time is at least 1 minute before now (X API requirement)
    const requestedEnd = new Date(lookbackEndDate);
    const safeMax = subMinutes(new Date(), 1);
    const endTime = requestedEnd > safeMax ? safeMax.toISOString() : requestedEnd.toISOString();

    const result = await fetchTweetCounts(query, startTime, endTime);

    console.log(`[Result] ${result.data.length} data points, ${result.totalTweets.toLocaleString()} total tweets`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch counts error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tweet counts' },
      { status: 500 }
    );
  }
}
