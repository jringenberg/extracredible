import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OG_SIZE = 1200;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const response = new ImageResponse(
    (
      <div
        style={{
          width: OG_SIZE,
          height: OG_SIZE,
          background: '#000',
        }}
      />
    ),
    {
      width: OG_SIZE,
      height: OG_SIZE,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'Content-Type': 'image/png',
      },
    }
  );

  return response;
}
