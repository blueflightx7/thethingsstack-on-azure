import { Suspense } from 'react';
import HivePageClient from './HivePageClient';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HivePageClient />
    </Suspense>
  );
}
