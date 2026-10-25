# Hyperframes Composition Brief: CroVim

## Objective
Create a 20-second polished launch-style brag video for CroVim, a Vim-style keyboard navigation extension for Chrome.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `/home/seanizonfire/Desktop/selfProj/CroVim`
- Primary files read: `README.md`, `manifest.json`, `src/pages/popup/index.html`, `src/pages/popup/popup.css`, `src/pages/vomnibar/index.html`, `src/pages/vomnibar/vomnibar.css`, `src/pages/options/index.html`, `src/pages/options/options.css`
- Product name: CroVim
- Tagline / strongest claim: “Move with intent. Your browser, tuned for flow.”
- Key UI or visual moment to recreate: the popup status card and the Vomnibar search/result surface
- Copy that must appear verbatim:
  - `Move with intent. Your browser, tuned for flow.`
  - `Search tabs, history, bookmarks, or the web`
  - `CroVim is active on this tab`
  - `Vim-style keyboard navigation for Chrome.`

## Creative Direction
- Tone preset: polished
- Creative direction: a quiet command-line instrument for the browser
- Interpretation: calm, confident, premium; crisp reveals and restrained motion instead of hype.
- Angle: give the browser a keyboard layer it should have had all along.
- Hook: “THE WEB HAS A KEYBOARD. FINALLY, SO DOES YOUR BROWSER.”
- Outro / punchline: CroVim resolves into “Vim-style keyboard navigation for Chrome.”
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: `#f4f7f4` and deep ink `#17242a`
- Text: `#17242a`, white on dark panels
- Accent: `#087f73`
- Display font: Inter / system sans fallback
- Body font: Inter / system sans fallback
- Visual references from the project: teal signal dot, rounded white cards, mono eyebrow labels, dark brand mark, pale mint wash.

## Storyboard
1. Keyboard layer — 3s — dark hook with two readable lines
2. Popup / active tab — 4s — actual popup copy and status card
3. Vomnibar flow — 5s — actual search shell and sequential result types
4. Keyboard command burst — 4s — real README shortcuts
5. CroVim — 4s — grounded final product claim

## Audio
- Audio role: warm polished support with sparse professional accents
- Audio arc: music fades in under the hook, UI clicks support the popup and query, final bell lands with the wordmark.
- Music: `assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`
- Music treatment: volume 0.28, fade-in 0.4s, fade-out 0.8s, no ducking.
- Music cue guidance: `assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json`; major cue locks at 17.02s and 20.02s; result sequence aligns near 8.02s, 9.02s, and 10.02s.
- Audio-reactive treatment: subtle; a background halo breathes slightly with the music bed.
- Audio-coupled moments:
  - Query and first result — simulated typing/click.
  - Result row sequence — restrained click accents.
  - Final wordmark — soft bell on the beat.
- SFX selection guidance: use `ui/click1.ogg`, `ui/mouseclick1.ogg`, and `impact/impactBell_heavy_000.ogg`; keep levels below the music peak.
- SFX analysis guidance: `.agents/skills/brag/assets/sfx/sfx-analysis.json`
- Exact SFX choice: wired locally in the composition.
- Audio files: copied into `composition/assets/`.

## Hyperframes Instructions
Use the current Hyperframes HTML/GSAP contract. Keep all copy readable, keep the runtime at 20 seconds, use local media paths, register one paused root timeline, and mark beat-locked moments in the timeline. Do not add narration.
