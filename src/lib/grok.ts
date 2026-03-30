const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_MODEL = 'grok-3';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callGrok<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    throw new Error('GROK_API_KEY environment variable is not set');
  }

  const messages: GrokMessage[] = [
    {
      role: 'system',
      content: 'You are a helpful analytics assistant. Always respond with valid JSON only, no markdown or extra text.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  console.log(`[Grok] Calling ${GROK_MODEL} at ${GROK_API_URL}`);
  console.log(`[Grok] Prompt length: ${prompt.length} chars`);

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  console.log(`[Grok] Response status: ${response.status}`);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Grok API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const usage = data.usage;

  if (!content) {
    throw new Error('No content in Grok response');
  }

  console.log(`[Grok] Tokens used — prompt: ${usage?.prompt_tokens}, completion: ${usage?.completion_tokens}, total: ${usage?.total_tokens}`);
  console.log(`[Grok] Response preview: ${content.substring(0, 200)}...`);

  return JSON.parse(content) as T;
}
