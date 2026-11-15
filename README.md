# Voice Lab v0.2 — Vercel production

Original cinematic voice sample generator: Vintage Radio, Space Computer, Dark Horror. Generates 3 variations as 44.1 kHz / 24-bit mono WAV.

## Deployment

1. Import GitHub repository `abbendix/samplegenerator` into Vercel.
2. Set **Framework Preset: Other** and leave Root Directory at the repository root.
3. In Vercel **Settings → Environment Variables**, add:
   - `OPENAI_API_KEY`: your OpenAI API key (server-side only).
   - `APP_ACCESS_TOKEN`: a long random private password you choose. **Required** to prevent anonymous use of a paid API.
4. Set both for Production and redeploy via **Deployments → Redeploy** if necessary.
5. Open the production URL, enter the **APP_ACCESS_TOKEN** value in the app's Access Token field, enter text and generate.

**Never paste the OpenAI API key into the app's Access Token field.** The browser only sends the separate access token to your serverless endpoint. Do not commit secrets.

## Runtime

- Vercel serverless endpoint: `api/generate.js`.
- Static frontend: `public/`.
- No localhost, FFmpeg, or persistent Node.js server needed for production.
- AI speech: OpenAI `gpt-4o-mini-tts`; requires API billing/credits.
- Audio processing: pure JavaScript WAV decoder, simple tone filters, saturation and echo, 44.1 kHz/24-bit mono WAV export.
- BPM fitting is a **simple resampling stretch that changes pitch**. It is not a high-quality pitch-preserving time stretch; leave sync unchecked for natural voice.
- The legacy `server.js` is retained only for historical reference; Vercel uses `api/generate.js`.

## Security and limitations

Access token authentication is a basic shared password, not full user accounts. Do not share it. Set OpenAI usage budgets and monitor costs. The endpoint enforces input limits but has no per-user rate limiter. Three variations generate three paid requests. Vercel function duration limits may affect longer samples. No existing film audio or actor voice cloning.

## Status

Code committed to GitHub. Deployment and end-to-end voice generation require testing on the live Vercel project.
