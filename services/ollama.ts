/**
 * Ollama Local AI Service
 * Connects to local Ollama instance at http://localhost:11434
 */

const OLLAMA_BASE_URL = 'http://localhost:11434';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

/**
 * Lists all locally installed Ollama models.
 */
export async function listOllamaModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.models || [];
  } catch {
    return [];
  }
}

/**
 * Checks if the local Ollama server is running.
 */
export async function isOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Calls the local Ollama API using the OpenAI-compatible chat completions endpoint.
 */
export async function callOllama(
  messages: OllamaMessage[],
  modelName: string = 'llama3.2'
): Promise<string> {
  // Check if Ollama is running first
  const running = await isOllamaRunning();
  if (!running) {
    throw new Error(
      'Ollama is not running. Please open the Ollama application on your computer and try again.'
    );
  }

  let response: Response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 8192,
        },
      }),
    });
  } catch (err: any) {
    throw new Error(
      `Could not connect to Ollama at ${OLLAMA_BASE_URL}. Make sure Ollama is running on your computer.`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 404) {
      throw new Error(
        `Ollama model "${modelName}" is not installed. Run: ollama pull ${modelName}`
      );
    }
    throw new Error(`Ollama error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  if (!content.trim()) {
    throw new Error('Ollama returned an empty response. Please try a simpler prompt or a larger model.');
  }

  return content;
}
