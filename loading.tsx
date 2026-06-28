import { PageSkeleton } from './ui/skeletons';

export default function Loading() {
  // Next.js akan menampilkan UI ini sebagai fallback saat data halaman sedang dimuat.
  return <PageSkeleton />;
}