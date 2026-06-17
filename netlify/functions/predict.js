// Genera la predicción de Claude para un partido, con datos de contexto.

export async function handler(event) {
  const opp = event.queryStringParameters?.opp || 'el próximo rival';
  const context = event.queryStringParameters?.context || '';

  const prompt = `Eres un analista de fútbol frío y basado en datos. Predice el resultado de:
Colombia vs ${opp} — Mundial 2026, fase de grupos (Grupo K).
Contexto de Colombia: ${context || 'James Rodríguez capitán, Luis Díaz, DT Néstor Lorenzo, base de la Copa América 2024 subcampeón, llega irregular tras 2 derrotas en amistosos de marzo.'}

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
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const pick = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pick),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String(e) }) };
  }
}
