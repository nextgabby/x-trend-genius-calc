import { NextResponse } from 'next/server';
import { callGrok } from '@/lib/grok';
import { buildTrendExplanationPrompt } from '@/lib/prompts';
import type { SpikeContext, TweetSampleForPrompt } from '@/lib/prompts';
import type { TrendExplanation } from '@/lib/types';
import { fetchTweetSamples } from '@/lib/x-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, spike, campaignStartDate, campaignEndDate } = body as {
      query: string;
      spike: SpikeContext;
      campaignStartDate?: string;
      campaignEndDate?: string;
    };

    if (!query || !spike?.timestamp || spike.peakVolume == null) {
      return NextResponse.json(
        { error: 'Missing required fields: query, spike (with timestamp, peakVolume, avgVolume, medianVolume, spikeDurationHours, surroundingHours, eventHours)' },
        { status: 400 }
      );
    }

    console.log(`\n=== /api/analyze-threshold-hit ===`);
    console.log(`[Input] query: "${query.substring(0, 80)}...", peak: ${spike.timestamp}, volume: ${spike.peakVolume}, duration: ${spike.spikeDurationHours}h`);

    // Fetch actual tweet samples around the spike peak for context
    let tweetSamples: TweetSampleForPrompt[] = [];
    try {
      // Use a 2-hour window centered on the peak to get the most relevant tweets
      const peakTime = new Date(spike.timestamp);
      const sampleStart = new Date(peakTime.getTime() - 60 * 60 * 1000); // 1 hour before peak
      const sampleEnd = new Date(peakTime.getTime() + 60 * 60 * 1000);   // 1 hour after peak

      const rawTweets = await fetchTweetSamples(
        query,
        sampleStart.toISOString(),
        sampleEnd.toISOString(),
        50
      );

      tweetSamples = rawTweets.map((t) => ({
        text: t.text,
        created_at: t.created_at,
        retweets: t.public_metrics?.retweet_count,
        likes: t.public_metrics?.like_count,
      }));

      console.log(`[Tweets] Fetched ${tweetSamples.length} tweet samples for context`);
    } catch (tweetErr) {
      // Non-fatal — proceed with volume-only analysis if tweet fetch fails
      console.warn(`[Tweets] Failed to fetch tweet samples, proceeding without:`, tweetErr);
    }

    // Attach tweet samples to spike context
    const enrichedSpike: SpikeContext = {
      ...spike,
      tweetSamples,
    };

    const prompt = buildTrendExplanationPrompt(query, enrichedSpike, campaignStartDate, campaignEndDate);
    const result = await callGrok<TrendExplanation>(prompt);

    console.log(`[Result] confidence: ${result.confidence}, events: ${result.keyEvents?.length ?? 0}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Analyze threshold hit error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze threshold hit' },
      { status: 500 }
    );
  }
}
