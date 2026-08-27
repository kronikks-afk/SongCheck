// POST /api/next-lines
// Body: { lyricsSoFar: "..." }
// Returns: { suggestions: ["...", "...", ...] }
// Requires the GEMINI_API_KEY environment variable to be set in your
// Vercel project settings (Project -> Settings -> Environment Variables).

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

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const lyricsSoFar = (body.lyricsSoFar || '').toString().slice(0, 2000);
  if (!lyricsSoFar.trim()) {
    res.status(400).json({ error: 'lyricsSoFar is required' });
    return;
  }

  const prompt =
    'A songwriter is writing lyrics and wants help continuing. Here is what they have written so far ' +
    '(most recent line last):\n\n' + lyricsSoFar + '\n\n' +
    'Suggest 5 different possible next lines. Match the rhythm, syllable count, tone, and — where the ' +
    'existing lines rhyme with each other — the rhyme scheme of what is already written. Vary the ' +
    'suggestions: some should continue the thought, some should take it in a slightly new direction. ' +
    'Each suggestion should be a single line only, original text (never copied from any existing song).';

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
                suggestions: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['suggestions'],
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

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      res.status(502).json({
        error: 'Could not parse model response',
        detail: 'finishReason=' + (finishReason || 'unknown') + ' raw="' + text.slice(0, 200) + '"',
      });
      return;
    }

    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter(Boolean).slice(0, 6) : [];
    res.status(200).json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
