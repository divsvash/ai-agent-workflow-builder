import { env } from '../env';

// Isolated LLM provider integration. Everything outside this file talks to
// `callLLM`, never to Groq's API shape directly — swapping providers later
// (Gemini, OpenRouter, etc.) means rewriting only this module.

export interface LLMCallConfig {
  prompt: string;
  model?: string;
  system?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface LLMCallResult {
  text: string;
  raw: any;
}

export async function callLLM(config: LLMCallConfig): Promise<LLMCallResult> {
  const messages: { role: string; content: string }[] = [];
  if (config.system) {
    messages.push({ role: 'system', content: config.system });
  }
  messages.push({ role: 'user', content: config.prompt });

  const response = await fetch(env.groqApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.groqApiKey()}`,
    },
    body: JSON.stringify({
      model: config.model || env.groqDefaultModel(),
      messages,
      temperature: config.temperature ?? 0.3,
      max_tokens: config.max_tokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Groq API error (${response.status}): ${bodyText.slice(0, 500)}`);
  }

  const json: any = await response.json();
  const text = json?.choices?.[0]?.message?.content ?? '';

  return { text, raw: json };
}
