import { ImageResponse } from 'next/og';
import { getBelief } from '@/lib/subgraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const SQUARE_SIZE = 630;
const SQUARE_PADDING = 48;

/** Font sizes tuned so text fits inside the 630×630 square with padding; nothing cropped. */
function getTextStyle(charCount: number): { fontSize: number; lineHeight: number } {
  if (charCount <= 0) return { fontSize: 22, lineHeight: 1.35 };
  if (charCount < 30) return { fontSize: 24, lineHeight: 1.35 };
  if (charCount < 80) return { fontSize: 20, lineHeight: 1.35 };
  if (charCount < 150) return { fontSize: 18, lineHeight: 1.35 };
  if (charCount < 250) return { fontSize: 16, lineHeight: 1.4 };
  if (charCount < 400) return { fontSize: 14, lineHeight: 1.4 };
  return { fontSize: 12, lineHeight: 1.45 };
}

/** Lora from Google Fonts (serif). Returns null on failure so we can still render. */
async function loadSerifFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(
      'https://github.com/google/fonts/raw/main/ofl/lora/Lora%5Bwght%5D.ttf',
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

/** Minimal fallback image when anything fails — ensures we always return a valid PNG. */
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
            name: 'Lora',
            data: fontData,
            weight: 400 as const,
            style: 'normal' as const,
          },
        ]
      : undefined;

    const response = new ImageResponse(
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
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              background: '#000',
              color: '#fff',
              padding: SQUARE_PADDING,
              fontFamily: fonts ? 'Lora, serif' : 'serif',
              fontSize,
              lineHeight,
              textAlign: 'left',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {text}
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

    return response;
  } catch (error) {
    console.error('[api/og/belief]', error);
    return fallbackImage('Belief');
  }
}
