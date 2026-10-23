import type { Metadata } from 'next';
import { copy } from '@/shared/lib/copy';
import { HomeView } from './_components/home-view';

export const metadata: Metadata = { title: copy.pages.home };

export default function HomePage() {
  return <HomeView />;
}
