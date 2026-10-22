# Design: "Country cottage"

A warm, pastoral look: linen paper, garden greens, terracotta pots, honey and blossom. Calm and friendly, like a hand-kept holiday planner on a farmhouse table. Owned by the Lead; Frontend implements it in `public/`.

## Principles

- **Soft, not twee.** Warm colours and rounded shapes, but the information (balances, breaks, warnings) stays crisp and easy to scan.
- **Meaning first.** Every calendar marking keeps a distinct colour and the legend matches it. A "short" trip must still read as a clear warning.
- **Offline.** No CDN or remote assets (CLAUDE.md rule 7). Fonts are bundled in `public/fonts/`; decorations are inline SVG or CSS.
- **Readable.** Body text and button text meet WCAG AA contrast (4.5:1). Works at 375 px with no sideways scrolling.

## Colour tokens

Define these as CSS custom properties on `:root` and use only the tokens elsewhere.

| Token | Value | Use |
|---|---|---|
| `--linen` | `#FBF6EC` | Page background |
| `--paper` | `#FFFDF8` | Panels and cards |
| `--oat` | `#EFE8DA` | Weekends, subtle fills, input backgrounds |
| `--line` | `#E2D6C0` | Borders and dividers |
| `--ink` | `#3E3A2E` | Main text (deep olive brown) |
| `--ink-soft` | `#756C5B` | Secondary text, notes |
| `--sage` | `#4F7356` | Primary buttons, links, headings accent (white text on it passes AA) |
| `--sage-light` | `#DCE7D8` | Tags, soft highlights, hover fills |
| `--leaf` | `#5E8B67` | "Your leave day" cells |
| `--terracotta` | `#B8653F` | Decorative accents, badges |
| `--clay-light` | `#F4D9CC` | WA public holiday cells |
| `--honey` | `#E3B04B` | WA school holiday bar |
| `--butter` | `#F6E7B8` | Success and "new" highlights |
| `--blossom` | `#D98B8B` | China holiday dot (estimate: same colour at 45% opacity) |
| `--berry` | `#A8372B` | Errors and the "Not enough leave" warning |
| `--berry-light` | `#F8E1DC` | Warning box background |

Crowd tags: low = `--sage-light` with `--sage` text; mid = `--butter` with `#7A5A12` text; high = `--clay-light` with `#8A3F22` text; peak = `--berry` with white text.

## Type

- **Headings:** Fraunces (variable, soft serif), weights 600 to 700, slightly loose letter spacing. Fallback: `Georgia, "Times New Roman", serif`.
- **Body and UI:** Nunito (rounded sans), 400 and 700. Fallback: `"Segoe UI", system-ui, sans-serif`.
- Both are SIL Open Font License. Download the woff2 files (Latin subset only) into `public/fonts/`, add `@font-face` rules with `font-display: swap`, and commit the licence files alongside them.
- Sizes: body 16 px, line height 1.6. Page title about 2.2 rem, section headings 1.5 rem, card titles 1.15 rem.

## Shapes and depth

- Radius: 16 px for panels, 12 px for cards, 999 px for buttons, tags and badges.
- Shadow: soft and warm, e.g. `0 2px 0 rgba(62, 58, 46, 0.04), 0 8px 24px rgba(120, 96, 60, 0.08)`. No hard black shadows.
- Borders: 1 px `--line`. Placeholder or "add" cards use a dashed "stitched" border.
- Spacing: generous, at least 24 px inside panels on desktop and 16 px on mobile.

## Header

- Soft gradient from `--sage-light` to `--linen`, with dark `--ink` text (not white on a solid block).
- Along the bottom edge, an inline SVG of gentle rolling hills in two or three greens, with a small sun or a few leaves. Keep it under about 2 KB.
- The "Server connected" pill becomes a small sage tag with a leaf dot.
- The section nav becomes rounded pill links with a `--sage-light` hover.

## Components

- **Panels:** `--paper` background, 16 px radius, warm shadow. Each `h2` has a small inline SVG sprig (leaf or flower) before it. Use one shared `<svg><symbol>` sprite in `index.html` and reference it with `<use>`.
- **Buttons:** pill shaped. Primary is `--sage` with white text and a slightly darker hover. Secondary is `--paper` with a `--sage` border and text. Show a visible focus ring (2 px `--honey` outline).
- **Inputs:** `--oat` background, 10 px radius, `--line` border, `--sage` border on focus.
- **Trip cards:** `--paper`, 12 px radius. Source badges are pills (preset = terracotta, activity = sage, custom = honey, AI = blossom). The break length is the biggest number, in Fraunces. A disabled card fades to 55% opacity with a dashed border. A short card gets a `--berry` left border and a `--berry-light` warning box with an icon.
- **Month cards:** a small seasonal icon by the month name (sun for hot, leaf for comfortable, snowflake or cloud for cold). Day cells are 8 px rounded squares. Today and highlighted cells get a `--honey` ring.
- **Calendar markings:** weekend = `--oat`; WA public holiday = `--clay-light` with `--terracotta` text; leave day = `--leaf` with white text; trip span = 2 px `--sage` outline; WA school holiday = 3 px `--honey` bar along the bottom; China holiday = `--blossom` dot (45% opacity when it's an estimate); China make-up workday = a small `--blossom` ring. Update the legend swatches to match.
- **Activity cards:** category badge pills, with the tips set in slightly smaller text. "Plan this" is a primary button.
- **Messages:** success uses a `--butter` background, warning uses honey, error uses `--berry-light` with `--berry` text, each with a rounded 10 px box.
- **Footer:** a small hand-drawn wavy SVG divider above it, with a friendly line of text.

## Motion

Subtle only: 150 to 200 ms ease on hover and focus, and a soft `--butter` glow on a newly added trip card that fades over 1.5 s. Respect `prefers-reduced-motion`.

## Don't

- Don't change element IDs, `data-` attributes, or class names that `app.js` relies on. Restyle them, or add new classes alongside.
- Don't add frameworks, CSS libraries, icon fonts or remote images.
- Don't put text over busy decoration, and don't let decoration push content sideways on mobile.
