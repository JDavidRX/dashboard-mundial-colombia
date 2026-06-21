// netlify/functions/predict.js
// Genera la predicción de Claude para un partido, con datos de contexto.
// El dashboard (o vos antes de cada partido) llama a /.netlify/functions/predict?opp=Portugal
//
// Variable de entorno en Netlify:
//   ANTHROPIC_API_KEY = tu_key_de_anthropic   (consíguela en console.anthropic.com)
//
// Devuelve { score, market, confidence, reason } para pegarlo en el dashboard.

export async function handler(event) {
  const opp = event.queryStringParameters?.opp || 'el próximo rival';
  const context = event.queryStringParameters?.context || '';
  const DEFAULT_CONTEXT = 'James Rodríguez capitán (34), Luis Díaz (Bayern Múnich), DT Néstor Lorenzo, base de la Copa América 2024 (subcampeón). Llega en alza: cerró la preparación con 2 victorias en junio (3-1 vs Costa Rica, 2-0 vs Jordania) tras un marzo flojo (derrotas con Francia y Croacia).';

  const prompt = `Eres un analista de fútbol frío y basado en datos. Predice el resultado de:
Colombia vs ${opp} — Mundial 2026, fase de grupos (Grupo K).
Contexto de Colombia: ${context || DEFAULT_CONTEXT}

Responde SOLO con un JSON válido, sin texto extra, con esta forma exacta:
{"score":"X – Y","market":"COL|DRAW|OPP","confidence":NUMERO_0_100,"reason":"una frase corta y fría"}
score es el marcador Colombia-rival. market es quién gana segun tu predicción.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const raw = await res.text(); // leemos texto crudo primero, así nunca explota el JSON.parse
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }

    if (!res.ok) {
      // Devolvemos el error real de Anthropic (auth inválida, sin crédito, modelo incorrecto, etc.)
      const msg = data?.error?.message || raw || `HTTP ${res.status}`;
      return {
        statusCode: 200, // 200 a propósito: así el frontend puede leer p.error sin romperse
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Anthropic API (${res.status}): ${msg}` }),
      };
    }

    const text = (data?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();

    if (!clean) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Claude respondió vacío. Revisá el prompt o el modelo.' }),
      };
    }

    const pick = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pick),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Error de función: ${String(e)}` }),
    };
  }
}
