---
applyTo: "**/*.{astro,css,tsx,jsx,ts,js,html}"
description: "Frontend design tokens (retro JRPG theme)"
---

# Frontend Design Rules

When working on styles, components, or layouts, always apply the tokens below.

## Theme

A retro JRPG / cyberpunk arcade. A radial background of deep purple → midnight → pitch black, with neon accents and pixel-style typography.

## Colors

| Role                       | Hex       | Tailwind            |
| -------------------------- | --------- | ------------------- |
| Pitch black (base)         | `#05060f` | `bg-shadow-ink`     |
| Midnight (panels)          | `#0a0e27` | `bg-midnight`       |
| Deep purple (top of bg)    | `#1a0b2e` | `bg-deep-purple`    |
| Neon magenta               | `#ff2e88` | `text-neon-magenta` |
| Neon cyan                  | `#00f0ff` | `text-neon-cyan`    |
| Amber                      | `#ffb000` | `text-crt-amber`    |
| Phosphor green             | `#9bbc0f` | `text-gb-green`     |
| Body text                  | `#e8f4ff` | `text-phosphor`     |

Build the `body` background as a radial gradient from deep purple → midnight → pitch black.

## Entry accent tokens

Playbook Markdown frontmatter includes exact Tailwind classes under `accent`.
Use these values directly for each card or detail page instead of guessing from ordinary color words.

Example:

```yaml
color: cyan
accent:
  text: text-neon-cyan
  border: border-neon-cyan
  glow: hover:shadow-neon-cyan
  shadow: shadow-neon-cyan
  hex: "#00f0ff"
```

For a Copilot entry with `color: cyan`, use `accent.text`, `accent.border`, `accent.glow`, and `accent.hex` from the Markdown. Do **not** introduce generic Tailwind colors like `text-blue-500`.

## Fonts

| Usage                                      | Font                | Tailwind        |
| ------------------------------------------ | ------------------- | --------------- |
| Brand headings (H1, logo, top-level label) | `'Press Start 2P'`  | `font-pixel`    |
| Body + headings (JA + EN, default prose)   | `'DotGothic16'`     | `font-pixel-jp` |
| Presentation chrome (slide counter, etc.)  | `'VT323'`           | `font-terminal` |
| Code blocks                                | `'IBM Plex Mono'`   | `font-mono`     |

`'Press Start 2P'` has no lowercase glyphs (everything renders uppercase), so reserve it for brand logos and top-level titles only. Use **`font-pixel-jp` (DotGothic16) for all prose** — body, section headings, TOC, link lists, card descriptions — it covers JA and Latin on a single pixel grid. Always fall back to `monospace` / `sans-serif`.

## Effects

- Subtle CRT scanlines (`.crt-lines`) as a full-screen overlay.
- Neon glow: `shadow-neon-magenta` / `-cyan` / `-amber` / `-green` (= `0 0 8px <color>, 0 0 24px <rgba>`).
- Borders: `1px dashed` or `2px solid` in a neon color. Keep contrast high — no soft pastel gradients.

## Do not

- Use bright / white backgrounds.
- Use pill shapes or border-radius greater than 4px.
- Use soft gray drop shadows (use glows only).