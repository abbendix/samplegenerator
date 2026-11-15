# Voice Lab v0.2 — Vercel production

Original cinematic voice sample generator: Vintage Radio, Space Computer, Dark Horror. Generates 3 variations as MP3 audio.

## Deployment

1. Import GitHub repository `abbendix/samplegenerator` into Vercel.
2. Set **Framework Preset: Other** and leave Root Directory at the repository root.
3. In Vercel **Settings → Environment Variables**, add:
   - `OPENAI_API_KEY`: your OpenAI API key (server-side only).
4. Set the key for Production and redeploy via **Deployments → Redeploy** if necessary.
5. Open the production URL, enter text and generate.

**Never paste your OpenAI API key into the browser or commit it.**

## Runtime

- Vercel serverless endpoint: `api/generate.js`.
- Static frontend: `public/`.
- No localhost, FFmpeg, or persistent Node.js server needed for production.
- AI speech: OpenAI `gpt-4o-mini-tts`; requires API billing/credits.
- Audio output: OpenAI MP3 returned directly to the browser, without WAV decoding or transcoding.
- BPM synchronization and additional DSP effects are temporarily disabled in this MP3 troubleshooting release.
- The legacy `server.js` is retained only for historical reference; Vercel uses `api/generate.js`.

## Security and limitations

**Development mode: no authentication. Anyone who finds the public URL can use your paid API.** Set OpenAI usage budgets and monitor costs. Re-enable authentication before wider release. The endpoint enforces input limits but has no per-user rate limiter. Three variations generate three paid requests. Vercel function duration limits may affect longer samples. No existing film audio or actor voice cloning.

## Status

Code committed to GitHub. Deployment and end-to-end voice generation require testing on the live Vercel project.
