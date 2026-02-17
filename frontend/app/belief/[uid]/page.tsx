'use client';

import { useParams } from 'next/navigation';
import { HomeContent } from '@/app/page';

export default function BeliefPage() {
  const params = useParams();
  const uid = params.uid as string;

  return <HomeContent initialSort="belief" filterValue={uid} />;
}
