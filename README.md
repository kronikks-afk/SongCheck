# Signal Check

Upload an MP3, get real measured audio metrics (peak, loudness, dynamic
range, clipping, frequency balance, estimated BPM, stereo width), plus
AI-written mixing notes and an original AI lyrics generator — running
entirely on Google's **free** Gemini API tier.

All audio analysis runs client-side in the browser (Web Audio API — no
audio file ever leaves the user's machine). Two small serverless
functions call the Gemini API on the server side, so your API key is
never exposed to the browser.

## Project structure

```
index.html          the whole frontend (single file)
api/mix-feedback.js  serverless function -> AI mixing notes
api/lyrics.js         serverless function -> AI lyrics generator
package.json
```

## Deploy to Vercel (free)

**1. Get a free Gemini API key**
Go to https://aistudio.google.com/apikey, sign in with a Google account,
and click "Create API key." No credit card, no expiration. This uses
the Gemini 2.5 Flash model, which is on Google's permanent free tier
(roughly 1,500 requests/day — far more than a personal project needs).

Note: on the free tier, Google may use your prompts to improve their
models. This app only sends measured numbers (loudness, frequency
bands, etc.) and your lyrics prompt fields — never the audio file
itself — but keep that in mind if that matters to you.

**2. Push this folder to a GitHub repo** (or deploy directly with the CLI, see below).

**3. Import into Vercel**
- Go to https://vercel.com/new and import the repo (or run `vercel` from
  this folder with the Vercel CLI installed: `npm i -g vercel`).
- Framework preset: choose **Other** — no build step is needed.

**4. Add your API key as an environment variable**
In the Vercel project: **Settings -> Environment Variables**, add:

```
GEMINI_API_KEY = your key from AI Studio
```

Apply it to Production (and Preview/Development if you'll test those).
Redeploy after adding it — env vars only apply to new deployments.

**5. Done**
Your site will be live at `your-project.vercel.app`. Both the mixing
notes and lyrics generator call `/api/mix-feedback` and `/api/lyrics` on
your own domain, so there's no CORS issue and the key stays server-side.

## Local development

```bash
npm i -g vercel
vercel dev
```

This serves `index.html` and the `/api` functions together on
`localhost:3000`, using a `.env` file (or `vercel env pull`) for
`GEMINI_API_KEY`.

## Notes

- The model used server-side is `gemini-3.5-flash-lite`, currently on
  Google's free tier. Google has been retiring older model IDs quickly
  in 2026 (`gemini-2.5-flash-lite` was pulled from new users mid-year),
  so if you get a 404 "no longer available" error in the future, check
  https://ai.google.dev/gemini-api/docs/models for the current name and
  swap the model string in `api/mix-feedback.js`, `api/next-lines.js`,
  and `api/lyrics.js`.
- The BPM estimate is a lightweight autocorrelation-based guess, not a
  professional beat detector — it's fine for a rough read, not for
  syncing to a DAW.
- Session history (past scores) is stored in the browser's
  `localStorage`, per-device — it isn't shared across users or devices.
- If you ever outgrow the free tier's daily request cap, the same code
  works with a paid Gemini or Anthropic key — just point the fetch URL
  and payload shape at the provider you switch to.
