import { NextResponse } from 'next/server';
import { fetchTweetCounts } from '@/lib/x-api';
import { resolveCountWindow } from '@/lib/count-window';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, lookbackStartDate, lookbackEndDate, recentProxyWhenUnstarted } = body;

    if (!query || !lookbackStartDate || !lookbackEndDate) {
      return NextResponse.json(
        { error: 'Missing required fields: query, lookbackStartDate, lookbackEndDate' },
        { status: 400 }
      );
    }

    console.log(`\n=== /api/fetch-counts ===`);
    console.log(`[Input] query: "${query}"`);
    console.log(`[Input] lookbackStartDate: ${lookbackStartDate}, lookbackEndDate: ${lookbackEndDate}`);

    const resolved = resolveCountWindow({
      start: lookbackStartDate,
      end: lookbackEndDate,
      recentProxyWhenUnstarted: recentProxyWhenUnstarted === true,
    });

    if (!resolved.ok) {
      console.log(`[Resolved] rejected: ${resolved.error}`);
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const { window } = resolved;
    console.log(`[Resolved] kind: ${window.kind}, startTime: ${window.startTime}, endTime: ${window.endTime}`);

    const result = await fetchTweetCounts(query, window.startTime, window.endTime);

    console.log(`[Result] ${result.data.length} data points, ${result.totalTweets.toLocaleString()} total tweets`);
    console.log(`[Result] First point: ${result.data[0]?.timestamp} (${result.data[0]?.count}), Last point: ${result.data[result.data.length - 1]?.timestamp} (${result.data[result.data.length - 1]?.count})`);

    return NextResponse.json({ ...result, window });
  } catch (error) {
    console.error('Fetch counts error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tweet counts' },
      { status: 500 }
    );
  }
}
