'use client';

import { Suspense } from 'react';
import { Spinner } from '@fluentui/react-spinner';
import TheatreClient from './TheatreClient';

export default function TheatrePage() {
  return (
    <Suspense 
      fallback={
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: 'white',
        }}>
          <Spinner size="huge" label="Loading Theatre Mode..." />
        </div>
      }
    >
      <TheatreClient />
    </Suspense>
  );
}
