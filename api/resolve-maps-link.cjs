// api/resolve-maps-link.cjs
// Resolves a Google Maps link (short or long) to lat/lon coordinates using
// the Gemini API. Mirrors the pattern used in parse-recipe.cjs: a small
// CommonJS serverless function that proxies the AI call server-side so the
// API key never reaches the browser, and so the fetch isn't blocked by CORS.

module.exports = async (req, res) => {
  // CORS — allow calls from the deployed app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing "url" in request body' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    return;
  }

  try {
    const prompt = `Resolve this Google Maps link and return ONLY the latitude and ` +
      `longitude of the location it points to. Respond with ONLY valid JSON, ` +
      `no markdown formatting, no other text, in exactly this format: ` +
      `{"lat": 39.1234, "lon": -86.5678}\n\nLink: ${url}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }]
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      res.status(502).json({ error: `Gemini API error: ${geminiRes.status}`, detail: errText.slice(0, 300) });
      return;
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      res.status(502).json({ error: 'Could not parse coordinates from Gemini response', raw: clean.slice(0, 200) });
      return;
    }

    if (typeof parsed.lat !== 'number' || typeof parsed.lon !== 'number') {
      res.status(502).json({ error: 'Gemini response missing valid lat/lon' });
      return;
    }

    res.status(200).json({ lat: parsed.lat, lon: parsed.lon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
