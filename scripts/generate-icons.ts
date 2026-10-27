import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = resolve(root, 'public/logo.svg');
const iconsDir = resolve(root, 'public/icons');
const screenshotsDir = resolve(root, 'public/screenshots');

async function main() {
  await mkdir(iconsDir, { recursive: true });
  await mkdir(screenshotsDir, { recursive: true });
  const svg = await readFile(svgPath);

  await sharp(svg).resize(192, 192).png().toFile(resolve(iconsDir, 'icon-192.png'));
  await sharp(svg).resize(512, 512).png().toFile(resolve(iconsDir, 'icon-512.png'));
  await sharp(svg).resize(180, 180).png().toFile(resolve(root, 'public/apple-touch-icon.png'));

  // Maskable icons with safe-zone padding on #121214 background
  for (const size of [192, 512]) {
    const inner = Math.round(size * 0.76);
    const pad = Math.round((size - inner) / 2);
    const resized = await sharp(svg).resize(inner, inner).png().toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: '#121214' },
    })
      .composite([{ input: resized, top: pad, left: pad }])
      .png()
      .toFile(resolve(iconsDir, `maskable-${size}.png`));
  }

  // Rich install UI screenshots (narrow + wide)
  const narrowSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="780" height="1688">
    <rect width="780" height="1688" fill="#121214"/>
    <rect x="60" y="180" width="660" height="1120" rx="32" fill="#202024" stroke="#8257E5" stroke-width="6"/>
    <text x="390" y="340" font-family="sans-serif" font-size="48" font-weight="bold" fill="#E1E1E6" text-anchor="middle">EnglishTalk</text>
    <text x="390" y="410" font-family="sans-serif" font-size="26" fill="#A8A8B3" text-anchor="middle">English Hub Rocketseat | LATAM</text>
    <rect x="120" y="520" width="540" height="90" rx="20" fill="#8257E5"/>
    <text x="390" y="578" font-family="sans-serif" font-size="32" font-weight="bold" fill="#FFFFFF" text-anchor="middle">Check in in 3 quick steps</text>
  </svg>`);
  await sharp(narrowSvg).png().toFile(resolve(screenshotsDir, 'narrow.png'));

  const wideSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <rect width="1920" height="1080" fill="#121214"/>
    <rect x="360" y="140" width="1200" height="800" rx="32" fill="#202024" stroke="#8257E5" stroke-width="6"/>
    <text x="960" y="360" font-family="sans-serif" font-size="64" font-weight="bold" fill="#E1E1E6" text-anchor="middle">EnglishTalk</text>
    <text x="960" y="440" font-family="sans-serif" font-size="34" fill="#A8A8B3" text-anchor="middle">English Hub Rocketseat | LATAM English Conversation</text>
    <rect x="660" y="560" width="600" height="100" rx="24" fill="#04D361"/>
    <text x="960" y="622" font-family="sans-serif" font-size="36" font-weight="bold" fill="#121214" text-anchor="middle">Register Attendance</text>
  </svg>`);
  await sharp(wideSvg).png().toFile(resolve(screenshotsDir, 'wide.png'));
}

void main();
