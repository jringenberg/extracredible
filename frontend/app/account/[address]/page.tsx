'use client';

import { useParams } from 'next/navigation';
import { HomeContent } from '@/app/page';

export default function AccountPage() {
  const params = useParams();
  const address = params.address as string;

  return <HomeContent initialSort="account" filterValue={address} />;
}
