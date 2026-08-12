/**
 * Hugging Face Inference API Service
 * Model: Qwen/Qwen2.5-Coder-32B-Instruct
 */

const HF_API_URL = 'https://api-inference.huggingface.co/models/Qwen/Qwen2.5-Coder-32B-Instruct/v1/chat/completions';

export interface HFMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Calls the Hugging Face Inference API using the chat completions endpoint.
 */
export async function callHuggingFace(
  messages: HFMessage[],
  maxTokens: number = 8192
): Promise<string> {
  const hfKey = typeof window !== 'undefined' ? localStorage.getItem('hf_api_key') : null;
  if (!hfKey) {
    throw new Error(
      'Hugging Face API key not configured. Please click "AI Config" and add your Hugging Face token.'
    );
  }

  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error('Hugging Face API key is invalid or expired. Please update it in AI Config.');
    }
    if (response.status === 429) {
      throw new Error(
        'Hugging Face rate limit reached. The free tier has limited requests per day. Please try again later.'
      );
    }
    if (response.status === 503) {
      throw new Error(
        'Hugging Face model is loading. This can take 20-60 seconds on first use. Please try again in a moment.'
      );
    }
    throw new Error(`Hugging Face API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('Hugging Face returned an empty response. Please try again.');
  }

  const content = data.choices[0]?.message?.content || '';
  if (!content.trim()) {
    throw new Error('Hugging Face returned empty content. The model may have hit its output limit.');
  }

  return content;
}
