/**
 * xAI Grok API Service
 * Model: grok-4-5 (OpenAI-compatible endpoint)
 */

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_MODEL = 'grok-4-5';

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Calls the xAI Grok API using the OpenAI-compatible chat completions format.
 */
export async function callGrok(
  messages: GrokMessage[],
  maxTokens: number = 16384
): Promise<string> {
  const grokKey = typeof window !== 'undefined' ? localStorage.getItem('grok_api_key') : null;
  if (!grokKey) {
    throw new Error(
      'Grok API key not configured. Please click "AI Config" and add your xAI API key.'
    );
  }

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${grokKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error('Grok API key is invalid or expired. Please update it in AI Config.');
    }
    if (response.status === 429) {
      throw new Error(
        'Grok API rate limit reached. Please wait a moment and try again, or check your xAI billing limits.'
      );
    }
    if (response.status === 402) {
      throw new Error(
        'Grok API billing issue. Please check your xAI account credits at console.x.ai.'
      );
    }
    throw new Error(`Grok API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('Grok returned an empty response. Please try again.');
  }

  const content = data.choices[0]?.message?.content || '';
  if (!content.trim()) {
    throw new Error('Grok returned empty content. Please try a different prompt.');
  }

  return content;
}
