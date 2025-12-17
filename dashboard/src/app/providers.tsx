'use client';

import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { ReactNode, useEffect, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <FluentProvider theme={webLightTheme}>
      {children}
    </FluentProvider>
  );
}
