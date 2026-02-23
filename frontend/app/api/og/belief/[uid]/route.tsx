import { ImageResponse } from 'next/og';
import { getBelief } from '@/lib/subgraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OG_WIDTH = 1200;
const OG_HEIGHT = 628;
const CARD_SIZE = 628;

function getTextStyle(charCount: number): { fontSize: number; lineHeight: number } {
  if (charCount === 0) return { fontSize: 82, lineHeight: 1.25 };
  if (charCount < 30) return { fontSize: 231, lineHeight: 1.05 };
  if (charCount < 60) return { fontSize: 170, lineHeight: 1.1 };
  if (charCount < 100) return { fontSize: 129, lineHeight: 1.15 };
  if (charCount < 140) return { fontSize: 102, lineHeight: 1.2 };
  if (charCount < 180) return { fontSize: 88, lineHeight: 1.25 };
  if (charCount < 220) return { fontSize: 78, lineHeight: 1.28 };
  if (charCount < 260) return { fontSize: 71, lineHeight: 1.32 };
  if (charCount < 400) return { fontSize: 65, lineHeight: 1.35 };
  return { fontSize: 54, lineHeight: 1.4 };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;
  const belief = await getBelief(uid);
  const text = belief?.beliefText?.trim() || 'Belief';
  const { fontSize: rawFontSize, lineHeight } = getTextStyle(text.length);
  const scale = (CARD_SIZE - 84) / (1200 - 160);
  const fontSize = Math.round(rawFontSize * scale);

  const response = new ImageResponse(
    (
      <div
        style={{
          width: OG_WIDTH,
          height: OG_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          background: '#fff',
        }}
      >
        <div
          style={{
            width: CARD_SIZE,
            height: CARD_SIZE,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            background: '#000',
            color: '#fff',
            padding: 42,
            fontFamily: 'Times New Roman, serif',
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
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'Content-Type': 'image/png',
      },
    }
  );

  return response;
}
