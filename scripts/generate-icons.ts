/**
 * Regenerate every launcher / store / web / splash image from the brand mark.
 *
 *   npm run generate-icons
 *
 * Source of truth is the "staircase of dots" mark in
 * store-assets/svgs/habit-tracker-oji-mark-mono.svg (320x320 viewBox). Rather
 * than rasterize the flat brand SVGs as-is, we compose a wrapper SVG per target
 * so each output gets the right background, mark color, padding, and alpha:
 *
 *   - App / store / web icons are full-bleed OPAQUE squares (iOS forbids an
 *     alpha channel and rounds corners itself; Android masks its own shape), so
 *     the source's rounded corners + transparent margin would be wrong.
 *   - Android adaptive foreground + monochrome + the splash image need the mark
 *     scaled into a safe zone on a TRANSPARENT canvas.
 *
 * The chosen variant is blue: solid #0A80F6 background with white marks.
 */
import * as path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(__dirname, '..');
const BRAND_BLUE = '#0A80F6';
const WHITE = '#FFFFFF';

/**
 * The mark in its native 320x320 space, drawn in a single color (fills +
 * strokes). Content bounding box (incl. stroke) is ~26..294, i.e. centered on
 * (160,160) spanning ~268 units — so it's symmetric within the 320 box.
 */
function markGroup(color: string): string {
  const filled = [
    [60, 260],
    [160, 260],
    [160, 160],
    [260, 160],
    [260, 60],
  ];
  const hollow = [
    [60, 60],
    [160, 60],
    [60, 160],
    [260, 260],
  ];
  return `<g fill="none" stroke="${color}">
    <polyline points="60,260 160,260 160,160 260,160 260,60" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    ${filled.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="30" fill="${color}" stroke="none"/>`).join('\n    ')}
    ${hollow.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="30" stroke-width="8"/>`).join('\n    ')}
  </g>`;
}

/**
 * Compose a square SVG at `size` px: an optional background rect, then the mark
 * scaled so its 320-unit box occupies `boxFrac` of the canvas, centered.
 */
function composeSVG(opts: {
  size: number;
  bg: string | null;
  mark: string;
  boxFrac: number;
}): string {
  const { size, bg, mark, boxFrac } = opts;
  const box = boxFrac * size;
  const offset = (size - box) / 2;
  const scale = box / 320;
  const bgRect = bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bgRect}
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    ${markGroup(mark)}
  </g>
</svg>`;
}

type Target = {
  file: string;
  size: number;
  bg: string | null;
  mark: string;
  boxFrac: number;
  /** Opaque outputs drop the alpha channel entirely (required by iOS / stores). */
  opaque: boolean;
};

const TARGETS: Target[] = [
  // iOS + main app icon: full-bleed opaque square, no alpha channel.
  { file: 'assets/icon.png', size: 1024, bg: BRAND_BLUE, mark: WHITE, boxFrac: 0.625, opaque: true },
  // Web favicon.
  { file: 'assets/favicon.png', size: 64, bg: BRAND_BLUE, mark: WHITE, boxFrac: 0.625, opaque: true },
  // Android adaptive foreground: mark only, transparent, kept inside the safe zone.
  { file: 'assets/android-icon-foreground.png', size: 512, bg: null, mark: WHITE, boxFrac: 0.6, opaque: false },
  // Android adaptive background: plain solid brand color.
  { file: 'assets/android-icon-background.png', size: 512, bg: BRAND_BLUE, mark: BRAND_BLUE, boxFrac: 0, opaque: true },
  // Android monochrome (themed icons): single-color silhouette on transparent; OS tints it.
  { file: 'assets/android-icon-monochrome.png', size: 432, bg: null, mark: WHITE, boxFrac: 0.6, opaque: false },
  // Splash image: mark on transparent; expo-splash-screen places it on the brand background.
  { file: 'assets/splash-icon.png', size: 1024, bg: null, mark: WHITE, boxFrac: 0.85, opaque: false },
  // Store marketing icons.
  { file: 'store-assets/app-store-icon-1024.png', size: 1024, bg: BRAND_BLUE, mark: WHITE, boxFrac: 0.625, opaque: true },
  { file: 'store-assets/play-store-icon-512.png', size: 512, bg: BRAND_BLUE, mark: WHITE, boxFrac: 0.625, opaque: false },
];

async function main() {
  for (const t of TARGETS) {
    const svg = composeSVG({ size: t.size, bg: t.bg, mark: t.mark, boxFrac: t.boxFrac });
    let img = sharp(Buffer.from(svg)).resize(t.size, t.size);
    if (t.opaque) img = img.flatten({ background: t.bg ?? '#FFFFFF' });
    const out = path.join(ROOT, t.file);
    await img.png().toFile(out);
    console.log(`✓ ${t.file}  ${t.size}x${t.size}${t.opaque ? ' (opaque)' : ''}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
