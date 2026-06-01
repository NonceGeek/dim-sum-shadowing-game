# Dim Sum Shadowing Game

A Cantonese (粤语) shadowing practice web app built with Next.js. Listen to native audio, read lines with Jyutping, record your voice, and get instant pronunciation feedback. Part of the [AI DimSum](https://search.aidimsum.com) Cantonese learning ecosystem.

## Features

### Shadowing practice

- **Listen** — Play reference audio for each sentence (tap the speaker icon).
- **Read** — Cantonese text with inline Jyutping, plus Mandarin/standard Chinese gloss (原文).
- **Record** — Browser microphone capture with a live waveform (WaveSurfer.js).
- **Score** — Speech is transcribed (Cantonese) and compared to the target line; you receive a score (0–100) and short feedback. Scores above 70 trigger a celebration effect.

### Game mode (home)

Choose a **life-scenario** category, then work through sentences in order:

| Category | Topics |
|----------|--------|
| 饮食 | Food & dining |
| 问路 | Asking directions |
| 景点 | Sightseeing |
| 住宿 | Accommodation |
| 交通 | Transport |
| 询问 | Questions |
| 回答 | Responses |

Many items include a **character quiz**: pick the correct Cantonese characters (e.g. 唔 vs 吾, 嘢 vs 野) before or while you shadow. After the last question, view a **results table** with your transcript, target text, score, and feedback per line.

### Follow mode (`/follow`)

Focused shadowing without the character quiz:

- **Normal / slow playback** (0.5×) for easier repetition.
- **Deep links** — Open `/follow?uuid=<corpus_item_id>` to load a single sentence from the [AI DimSum backend](https://backend.aidimsum.com) corpus API.

### Corpus sets

Switch corpora on the home page:

- **粤语万句多用途生活场景有声语料集** — Everyday Cantonese by scenario (default).
- **功夫熊猫1** — Lines from *Kung Fu Panda* (Cantonese dub).

More sets (e.g. 广府童谣) may be added later.

## Tech stack

- [Next.js](https://nextjs.org) 15 (App Router), React 19, TypeScript
- [Tailwind CSS](https://tailwindcss.com) 4
- [Ant Design](https://ant.design) — UI components (tables, tooltips)
- [Zustand](https://github.com/pmndrs/zustand) — current question state
- [wavesurfer.js](https://wavesurfer.xyz) — recording waveform

Speech transcription uses a Cantonese ASR endpoint; scores are derived by comparing the transcript to the expected `yueText`.

## Getting started

Requires [Node.js](https://nodejs.org) 18+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3002](http://localhost:3002) (dev server runs on port **3002**).

```bash
pnpm build    # production build
pnpm start    # run production server
pnpm lint     # ESLint
```

### Browser permissions

Microphone access is required for recording. Use HTTPS or `localhost` so `getUserMedia` works reliably.

## Project layout

```
src/
  app/              # Routes: home (/), game (/game/[slug]), follow (/follow)
  components/     # Game, WaveRecorder, Category, ScoreDisplay, etc.
  data/           # Local category & question JSON (wanjui, gfxm1)
  stores/         # Zustand question store
  utils/          # Audio helpers
public/audio/     # Reference .m4a clips (yue1–yue53, …)
```

## Related links

- [AI DimSum 粤语语料库](https://search.aidimsum.com) — search and explore Cantonese corpus items
- Backend corpus API: `https://backend.aidimsum.com` (used by follow deep links)

## License

See repository settings or contact the maintainers for licensing terms.
