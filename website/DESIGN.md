## Theme Name: Zed × Space

```css
@theme {
  /* Void Surfaces */
  --color-void-900: #05060a;
  --color-void-800: #0a0b14;
  --color-void-700: #11121f;
  --color-void-600: #181a2a;
  --color-void-500: #232536;
  --color-void-400: #2f3147;

  /* Starlight Text */
  --color-star-100: #f0f4ff;
  --color-star-200: #c8cce6;
  --color-star-300: #969bb8;
  --color-star-400: #595d75;
  --color-star-500: #3b3f54;

  /* Cosmic Accents */
  --color-nebula: #82aaff;
  --color-aurora: #9d86d6;
  --color-comet: #5cc0c4;
  --color-supernova: #e0a864;
  --color-pulsar: #7ce0b0;
  --color-redshift: #c75d6f;

  /* Typography */
  --font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, monospace;
  --font-sans: "Geist", "IBM Plex Sans", system-ui, -apple-system, sans-serif;

  /* ============================================================
     BREAKPOINTS — semantic scale; retires sm/md/lg/xl/2xl
     ============================================================ */
  --breakpoint-*: initial;
  --breakpoint-minor-xs: 24rem; /* 384px — small phones                    */
  --breakpoint-minor-sm: 30rem; /* 480px — phablets, landscape phones      */
  --breakpoint-minor-md: 40rem; /* 640px — small tablets portrait          */
  --breakpoint-tablet: 48rem; /* 768px — tablets portrait, collapsed nav */
  --breakpoint-major-xs: 56rem; /* 896px — large tablets, collapsed nav    */
  --breakpoint-major-sm: 60rem; /* 960px — small desktop, tablet landscape */
  --breakpoint-major-md: 71.25rem; /* 1140px — standard laptop, multi-column  */
  --breakpoint-desktop-xl: 90rem; /* 1440px — large desktop, marketing sites */
  --breakpoint-ultrawide: 120rem; /* 1920px — ultra-wide monitors            */

  /* ============================================================
     FLUID TYPOGRAPHY — generates text-h1..h6, text-body
     Scales continuously from 320 px → 2560 px; no discrete jumps.
     ============================================================ */
  --text-h1: clamp(1.75rem, 5vw + 0.5rem, 4.5rem);
  --text-h1--line-height: 1.1;

  --text-h2: clamp(1.75rem, 1vw + 1.4rem, 2.5rem);
  --text-h2--line-height: 1.15;

  --text-h3: clamp(1.5rem, 0.7vw + 1.25rem, 1.875rem);
  --text-h3--line-height: 1.2;

  --text-h4: clamp(1.25rem, 0.5vw + 1.1rem, 1.5rem);
  --text-h4--line-height: 1.25;

  --text-h5: clamp(1.125rem, 0.3vw + 1.05rem, 1.25rem);
  --text-h5--line-height: 1.3;

  --text-h6: clamp(1rem, 0.2vw + 0.95rem, 1.125rem);
  --text-h6--line-height: 1.35;

  --text-body: clamp(0.875rem, 0.15vw + 0.85rem, 1rem);
  --text-body--line-height: 1.6;

  /* ============================================================
     FLUID SPACING — drives p-*, m-*, gap-*, space-*, inset-*
     One token definition → full utility family for free.
     ============================================================ */
  --spacing-section: clamp(2rem, 4vw + 1rem, 6rem);
  --spacing-block: clamp(1rem, 2vw + 0.5rem, 3rem);
  --spacing-inline: clamp(0.5rem, 1vw + 0.25rem, 1.5rem);
}
```
---

## THEME PHILOSOPHY

Void Interface is built on the belief that a developer's environment should be as unobtrusive as the vacuum of space—deep, calm, and free of noise. Every color is chosen to reduce eye strain during long sessions; every contrast level is tuned for focus rather than decoration.

We borrow from Zed Editor's functional minimalism: no heavy borders, no gratuitous shadows, no chrome that fights for attention. Surfaces sit in near-imperceptible layers, creating depth through luminance rather than ornament.

Then we let cosmic light do the talking. Typography glows with the cool, bluish-white of distant starlight. Accents are restrained to faint nebulae and auroras—present enough to guide, quiet enough not to distract. Color is not decoration here; it is signal. In this theme, darkness is not an absence. It is the medium. The void is the canvas. And the light is strictly functional.


### Styling (Tailwind CSS v4)
- Tailwind utility classes only. No inline `style={{}}` unless driven by a truly dynamic runtime value unavailable in Tailwind.
- No custom CSS files unless Tailwind cannot express the requirement — document why when added.
- Use Tailwind v4's CSS-first configuration (`@import "tailwindcss"`). Extend via `@theme` blocks rather than legacy JS config unless the project already relies on specific v3 plugins.
- Responsive and accessible by default: every interactive element must be keyboard-navigable, include visible focus states, and meet WCAG AA contrast.
- **The cosmic background classes** (`.cosmic-bg`, `.nebula-orb`, `.starfield`, `.space-grid`, `.noise-overlay`) defined in `src/styles/global.css` are the one justified exception to the no-custom-CSS rule — `filter: blur()`, `@keyframes`, and `mask-image` with CSS variables cannot be expressed purely in Tailwind utilities.


### Page Canvas & Atmospheric Background

A flat, single-color dark surface feels hollow on a large webpage canvas. **Every page layout must render the full four-layer atmospheric system** defined in `src/styles/global.css`. Never ship a layout with just `bg-void-800` or `bg-void-900` as the sole background.

#### The Four Layers — mount them in this exact order inside `<body>`, before all content:

```html
<!-- All four layers are aria-hidden and pointer-events: none -->
<div class="cosmic-bg" aria-hidden="true">
  <div class="nebula-orb primary"></div>
  <div class="nebula-orb secondary"></div>
  <div class="nebula-orb tertiary"></div>
  <div class="starfield"></div>
  <div class="space-grid"></div>
</div>
<div class="noise-overlay" aria-hidden="true"></div>

<!-- All page content must sit at z-index ≥ 10 -->
<div class="relative z-10">
  <!-- page content here -->
</div>
```

#### Layer Rules

| Layer | CSS Class | Purpose | Max Opacity |
|-------|-----------|---------|-------------|
| **Deep Void Base** | `.cosmic-bg` | `void-800` foundation + contains all orbs | — |
| **Nebula Orbs** | `.nebula-orb.{primary\|secondary\|tertiary}` | Enormous blurred color masses (nebula/aurora/comet) that drift slowly | 13% |
| **Star Field** | `.starfield` | Dense 1–2px radial-gradient pinpricks tiled at non-square size | 65% |
| **Structure Grid** | `.space-grid` | Faint 80px `nebula`-tinted grid, edge-masked | 3.5% |
| **Film Grain** | `.noise-overlay` | SVG fractalNoise overlay that kills gradient banding | 3.5% |

#### Animation Guidelines

- Nebula orbs drift via `transform: translate()` over **20s–45s** `ease-in-out infinite alternate`. Opacity pulses between their min and max over **12s–15s**.
- **Never animate** `.starfield` or `.space-grid` via CSS background-image — too expensive. Use canvas/SVG for star twinkle if needed.
- Add `will-change: transform` only to `.nebula-orb` elements.

#### Responsive Behaviour

- On mobile (`max-width: 768px`): hide `.space-grid`, reduce `.starfield` opacity to `0.40`, hide `.nebula-orb.tertiary`.
- Use `position: fixed` on all background layers to eliminate scroll repaint costs.

#### Content Panel Surfaces

When a panel or form container needs a semi-opaque surface over the atmosphere, use:
```
bg-void-800/60 backdrop-blur-sm border border-void-500/20
```
This lets the atmospheric layers bleed through subtly, preserving depth while keeping content legible.
