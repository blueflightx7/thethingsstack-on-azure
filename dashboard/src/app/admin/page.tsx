import { Suspense } from 'react';
import AdminPageClient from './AdminPageClient';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AdminPageClient />
    </Suspense>
  );
}
