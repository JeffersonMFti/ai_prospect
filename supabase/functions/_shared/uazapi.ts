// Contrato C4 — envio de texto via uazapi (uazapiGO V2). POST /send/text, header token.
export interface UazapiResult {
  ok: boolean;
  status: number;
  body: unknown;
}

export async function sendText(phone: string, text: string): Promise<UazapiResult> {
  const base = Deno.env.get('UAZAPI_BASE_URL');
  const token = Deno.env.get('UAZAPI_TOKEN');
  if (!base || !token) throw new Error('UAZAPI_BASE_URL/UAZAPI_TOKEN não configurados.');

  const res = await fetch(`${base.replace(/\/$/, '')}/send/text`, {
    method: 'POST',
    headers: { token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: phone, text }),
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  return { ok: res.ok, status: res.status, body };
}

/** Valida telefone E.164 BR sem '+': 55 + DDD + número (12 ou 13 dígitos). */
export function isValidPhone(phone: string | null | undefined): phone is string {
  if (!phone) return false;
  return /^55\d{10,11}$/.test(phone);
}
