// Wrapper do Gemini 2.5 Flash com saída JSON + retry com backoff (F03 RN-03).
// Modelo e prompts: specs/04-ai-prompts.md

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export class GeminiError extends Error {}

interface GeminiOptions {
  systemPrompt: string;
  userPrompt: string;
  maxRetries?: number;
}

/**
 * Chama o Gemini forçando JSON e devolve o objeto já parseado.
 * Faz retry com backoff em erro de rede/429/5xx. Lança GeminiError se falhar tudo.
 */
export async function callGeminiJSON<T>(opts: GeminiOptions): Promise<T> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new GeminiError('GEMINI_API_KEY não configurada nos secrets.');

  const body = {
    systemInstruction: { parts: [{ text: opts.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: opts.userPrompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
  };

  const maxRetries = opts.maxRetries ?? 3;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new GeminiError(`Gemini HTTP ${res.status}`);
        await backoff(attempt);
        continue;
      }
      if (!res.ok) {
        throw new GeminiError(`Gemini HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new GeminiError('Resposta do Gemini sem texto.');

      return JSON.parse(text) as T;
    } catch (e) {
      lastErr = e;
      if (e instanceof SyntaxError) {
        // JSON inválido — não adianta retry imediato com mesmo prompt; aborta.
        throw new GeminiError(`JSON inválido do Gemini: ${(e as Error).message}`);
      }
      await backoff(attempt);
    }
  }
  throw new GeminiError(`Gemini falhou após ${maxRetries} tentativas: ${String(lastErr)}`);
}

function backoff(attempt: number): Promise<void> {
  return new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
}
