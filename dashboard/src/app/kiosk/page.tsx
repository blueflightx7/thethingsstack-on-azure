'use client';

import { Suspense } from 'react';
import KioskClient from './KioskClient';
import { Spinner } from '@fluentui/react-spinner';

export default function KioskPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        backgroundColor: '#0a0a0a'
      }}>
        <Spinner size="large" label="Loading Kiosk Mode..." />
      </div>
    }>
      <KioskClient />
    </Suspense>
  );
}
