import { ImageResponse } from 'next/og';
import { getBelief } from '@/lib/subgraph';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const revalidate = 3600;

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const SQUARE_SIZE = 630;
const SQUARE_PADDING = 64;

/** Font sizes tuned for centered layout with 502px usable width (630 - 2×64). Doubled for Nimbus. */
function getTextStyle(charCount: number): { fontSize: number; lineHeight: number } {
  if (charCount <= 0) return { fontSize: 96, lineHeight: 1.2 };
  if (charCount < 40) return { fontSize: 96, lineHeight: 1.2 };
  if (charCount < 100) return { fontSize: 72, lineHeight: 1.25 };
  if (charCount < 180) return { fontSize: 56, lineHeight: 1.3 };
  if (charCount < 300) return { fontSize: 44, lineHeight: 1.35 };
  if (charCount < 450) return { fontSize: 36, lineHeight: 1.4 };
  return { fontSize: 28, lineHeight: 1.45 };
}

/** Load Nimbus Roman No9 L from the local public/fonts directory — no network, no timeout risk. */
async function loadSerifFont(): Promise<ArrayBuffer | null> {
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NimbusRomNo9L-Reg.otf');
    const buffer = await fs.readFile(fontPath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch {
    return null;
  }
}

/** Minimal fallback image when anything fails — always returns a valid PNG. */
function fallbackImage(text: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: OG_WIDTH,
          height: OG_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          color: '#fff',
          padding: 80,
          fontSize: 48,
          lineHeight: 1.3,
          textAlign: 'center',
          wordBreak: 'break-word',
        }}
      >
        {text || 'Belief'}
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'Content-Type': 'image/png',
      },
    }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const belief = await getBelief(uid);
    const text = belief?.beliefText?.trim() || 'Belief';
    const { fontSize, lineHeight } = getTextStyle(text.length);

    const fontData = await loadSerifFont();
    const fonts = fontData
      ? [
          {
            name: 'Nimbus Roman No9 L',
            data: fontData,
            weight: 400 as const,
            style: 'normal' as const,
          },
        ]
      : undefined;

    return new ImageResponse(
      (
        <div
          style={{
            width: OG_WIDTH,
            height: OG_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000',
          }}
        >
          <div
            style={{
              width: SQUARE_SIZE,
              height: SQUARE_SIZE,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#000',
              padding: SQUARE_PADDING,
            }}
          >
            <div
              style={{
                color: '#fff',
                fontFamily: fonts ? 'Nimbus Roman No9 L' : 'serif',
                fontSize,
                lineHeight,
                textAlign: 'left',
                wordBreak: 'break-word',
              }}
            >
              {text}
            </div>
          </div>
        </div>
      ),
      {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        ...(fonts ? { fonts } : {}),
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          'Content-Type': 'image/png',
        },
      }
    );
  } catch (error) {
    console.error('[api/og/belief]', error);
    return fallbackImage('Belief');
  }
}
