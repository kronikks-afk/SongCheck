// POST /api/mix-feedback
// Body: the measured audio metrics (JSON).
// Returns: { score, summary, strengths[], issues[] }
// Requires the GEMINI_API_KEY environment variable to be set in your
// Vercel project settings (Project -> Settings -> Environment Variables).
// Get a free key (no credit card) at https://aistudio.google.com/apikey

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in your Vercel project settings.' });
    return;
  }

  let metrics;
  try {
    metrics = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const prompt =
    'You are an experienced mixing and mastering engineer. You are given objective, ' +
    'machine-measured audio metrics for a track (you cannot hear the audio itself). Based only on these ' +
    'numbers, write a review.\n\n' +
    'Metrics:\n' + JSON.stringify(metrics, null, 2) + '\n\n' +
    'Respond with ONLY raw JSON (no markdown fences, no preamble) matching exactly this shape:\n' +
    '{"score": <integer 0-100 reflecting overall mix/master readiness>, ' +
    '"summary": "<2-3 sentence overall take>", ' +
    '"strengths": ["<short strength tied to a real metric>", ...up to 3], ' +
    '"issues": [{"metric": "<short metric name>", "observation": "<what the number suggests>", "suggestion": "<concrete actionable fix>"}, ...2-4 items]}\n' +
    'Ground every point in the actual numbers given. Be specific and practical, like notes from a mix engineer, not generic advice.';

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                score: { type: 'INTEGER' },
                summary: { type: 'STRING' },
                strengths: { type: 'ARRAY', items: { type: 'STRING' } },
                issues: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      metric: { type: 'STRING' },
                      observation: { type: 'STRING' },
                      suggestion: { type: 'STRING' },
                    },
                    required: ['metric', 'observation', 'suggestion'],
                  },
                },
              },
              required: ['score', 'summary', 'strengths', 'issues'],
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      res.status(502).json({ error: 'Gemini API error', detail });
      return;
    }

    const data = await response.json();
    const finishReason = ((data.candidates || [])[0] || {}).finishReason;
    const text = ((((data.candidates || [])[0] || {}).content || {}).parts || [])
      .map((p) => p.text || '')
      .join('\n')
      .trim();
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      res.status(502).json({
        error: 'Could not parse model response',
        detail: 'finishReason=' + (finishReason || 'unknown') + ' raw="' + text.slice(0, 200) + '"',
      });
      return;
    }

    if (typeof parsed.score !== 'number') parsed.score = 50;
    parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
