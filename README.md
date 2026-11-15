# Voice Lab v0.1

A cinematic voice-sample generator for music production. Three original voice characters, male/female/neutral voices, three variations, 4/4 BPM timing, preview, and downloadable **44.1 kHz / 24-bit mono WAV**.

## Requirements

- Node.js 20+
- FFmpeg and ffprobe on PATH
- OpenAI API key with access to gpt-4o-mini-tts (billed separately)

## Local development

```bash
npm install
cp .env.example .env
# Set OPENAI_API_KEY in .env
npm run dev
```

Open http://localhost:3000.

## Architecture

Express serves the frontend and handles POST /api/generate. OpenAI TTS creates original speech; FFmpeg applies radio, space-computer or horror processing and optionally syncs the output to bars at the chosen BPM.

## Deployment warning

**This is a local MVP, not ready for public Vercel deployment.** It requires ffmpeg and ffprobe binaries, and its long-running Express process needs adapting for Vercel serverless. Before exposing paid TTS generation publicly, add authentication, rate limits, abuse protection and spending limits. Never commit your .env or API key.

Original synthetic performances; no film clips or actor voice cloning.