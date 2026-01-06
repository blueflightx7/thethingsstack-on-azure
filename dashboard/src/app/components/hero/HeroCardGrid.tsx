'use client';

import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';

const useStyles = makeStyles({
  grid: {
    display: 'grid',
    ...shorthands.gap('16px'),
  },
  // Dashboard layouts
  dashboardFull: {
    gridTemplateColumns: 'repeat(4, 1fr)',
    '@media (max-width: 1400px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  dashboardCompact: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    '@media (max-width: 600px)': {
      gridTemplateColumns: '1fr',
    },
  },
  // Kiosk layouts
  kioskLarge: {
    gridTemplateColumns: 'repeat(4, 1fr)',
    ...shorthands.gap('24px'),
    '@media (max-width: 1600px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  kioskMedium: {
    gridTemplateColumns: 'repeat(3, 1fr)',
    ...shorthands.gap('20px'),
    '@media (max-width: 1200px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  kioskSmall: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    ...shorthands.gap('16px'),
    '@media (max-width: 800px)': {
      gridTemplateColumns: '1fr',
    },
  },
  // TV/Theatre layouts
  tvLayout: {
    gridTemplateColumns: 'repeat(4, 1fr)',
    ...shorthands.gap('32px'),
  },
  theatreLayout: {
    gridTemplateColumns: 'repeat(4, 1fr)',
    ...shorthands.gap('48px'),
  },
  // Tile size modifiers
  tileSmall: {
    '& > *': {
      minWidth: 'unset',
      ...shorthands.padding('16px'),
    },
  },
  tileMedium: {
    '& > *': {
      minWidth: 'unset',
      ...shorthands.padding('20px'),
    },
  },
  tileLarge: {
    '& > *': {
      minWidth: 'unset',
      ...shorthands.padding('24px'),
    },
  },
  tileXLarge: {
    '& > *': {
      minWidth: 'unset',
      ...shorthands.padding('32px'),
    },
  },
});

export type GridLayout = 
  | 'dashboard-full' 
  | 'dashboard-compact' 
  | 'kiosk-large' 
  | 'kiosk-medium' 
  | 'kiosk-small'
  | 'tv'
  | 'theatre';

export type TileSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface HeroCardGridProps {
  /** Grid layout variant */
  layout?: GridLayout;
  /** Tile size */
  tileSize?: TileSize;
  /** Custom className */
  className?: string;
  /** Children (hero cards) */
  children: React.ReactNode;
}

export function HeroCardGrid({
  layout = 'dashboard-full',
  tileSize = 'medium',
  className,
  children,
}: HeroCardGridProps) {
  const styles = useStyles();

  const layoutClass = (() => {
    switch (layout) {
      case 'dashboard-full': return styles.dashboardFull;
      case 'dashboard-compact': return styles.dashboardCompact;
      case 'kiosk-large': return styles.kioskLarge;
      case 'kiosk-medium': return styles.kioskMedium;
      case 'kiosk-small': return styles.kioskSmall;
      case 'tv': return styles.tvLayout;
      case 'theatre': return styles.theatreLayout;
      default: return styles.dashboardFull;
    }
  })();

  const sizeClass = (() => {
    switch (tileSize) {
      case 'small': return styles.tileSmall;
      case 'medium': return styles.tileMedium;
      case 'large': return styles.tileLarge;
      case 'xlarge': return styles.tileXLarge;
      default: return styles.tileMedium;
    }
  })();

  return (
    <div className={mergeClasses(
      styles.grid,
      layoutClass,
      sizeClass,
      className
    )}>
      {children}
    </div>
  );
}

export default HeroCardGrid;
