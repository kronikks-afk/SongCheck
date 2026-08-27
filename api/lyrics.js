// POST /api/lyrics
// Body: { genre, mood, theme, keywords, structure }
// Returns: { lyrics: "..." }
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

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const genre = (body.genre || 'Pop').toString().slice(0, 60);
  const mood = (body.mood || '').toString().slice(0, 200);
  const theme = (body.theme || '').toString().slice(0, 800);
  const keywords = (body.keywords || '').toString().slice(0, 300);
  const structure = (body.structure || 'Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus').toString().slice(0, 300);

  if (!theme.trim()) {
    res.status(400).json({ error: 'A theme is required' });
    return;
  }

  const prompt =
    'Write original song lyrics. Do not reuse or paraphrase lyrics from any existing song — write something entirely new.\n\n' +
    'Genre: ' + genre + '\n' +
    (mood ? ('Mood/vibe: ' + mood + '\n') : '') +
    'Theme: ' + theme + '\n' +
    (keywords ? ('Imagery/keywords to weave in: ' + keywords + '\n') : '') +
    'Structure: ' + structure + '\n\n' +
    'Label each section clearly (e.g. "Verse 1", "Chorus") on its own line unless a freeform structure was requested. ' +
    'Respond with ONLY the lyrics text — no preamble, no explanation, no markdown formatting.';

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
          generationConfig: { maxOutputTokens: 1024 },
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      res.status(502).json({ error: 'Gemini API error', detail });
      return;
    }

    const data = await response.json();
    const text = ((((data.candidates || [])[0] || {}).content || {}).parts || [])
      .map((p) => p.text || '')
      .join('\n')
      .trim();

    if (!text) {
      res.status(502).json({ error: 'Empty response from model' });
      return;
    }

    res.status(200).json({ lyrics: text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
