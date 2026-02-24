import type { Metadata } from 'next';
import { getBelief } from '@/lib/subgraph';

function truncateForTitle(text: string, maxLen = 60): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + '…';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uid: string }>;
}): Promise<Metadata> {
  const { uid } = await params;
  const belief = await getBelief(uid);
  const title = belief?.beliefText?.trim()
    ? truncateForTitle(belief.beliefText)
    : 'Belief';
  const description = 'Stake $2 on this belief — Extracredible';
  const baseUrl = 'https://extracredible.xyz';
  const ogImageVersion = 5;
  const imageUrl = `${baseUrl}/api/og/belief/${encodeURIComponent(uid)}?v=${ogImageVersion}`;

  return {
    title: `${title} — Extracredible`,
    description,
    openGraph: {
      title: `${title} — Extracredible`,
      description,
      type: 'website',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — Extracredible`,
      description,
      images: [imageUrl],
    },
  };
}

export default function BeliefLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
