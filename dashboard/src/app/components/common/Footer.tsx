'use client';

import { makeStyles, shorthands } from '@griffel/react';
import { Text } from '@fluentui/react-text';
import { Link } from '@fluentui/react-link';
import { tokens } from '@fluentui/react-theme';

const useStyles = makeStyles({
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('16px', '24px'),
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    '@media (max-width: 768px)': {
      flexDirection: 'column',
      ...shorthands.gap('12px'),
      textAlign: 'center',
    },
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  poweredBy: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  azureBadge: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
    color: '#0078D4',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  githubLink: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
    color: tokens.colorNeutralForeground2,
    textDecoration: 'none',
    ':hover': {
      color: tokens.colorNeutralForeground1,
    },
  },
  divider: {
    width: '1px',
    height: '16px',
    backgroundColor: tokens.colorNeutralStroke2,
  },
});

// GitHub icon SVG
const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

// Azure icon SVG (small)
const AzureIconSmall = () => (
  <svg width="16" height="16" viewBox="0 0 96 96" fill="currentColor">
    <path d="M33.338 6.544h26.038l-27.03 80.087a4.152 4.152 0 0 1-3.933 2.824H8.149a4.145 4.145 0 0 1-3.928-5.47L29.404 9.368a4.152 4.152 0 0 1 3.934-2.825zm53.576 56.747H42.155a1.556 1.556 0 0 0-1.065 2.69l28.554 26.453a4.165 4.165 0 0 0 2.828 1.11h22.428zm-43.64-47.91L23.887 63.29h30.095a4.165 4.165 0 0 0 2.828-1.11l35.618-32.96a4.165 4.165 0 0 0-2.828-6.84z" />
  </svg>
);

export function Footer() {
  const styles = useStyles();

  return (
    <footer className={styles.footer}>
      <div className={styles.left}>
        <Text className={styles.poweredBy}>Powered by</Text>
        <span className={styles.azureBadge}>
          <AzureIconSmall />
          Azure IoT
        </span>
      </div>
      
      <div className={styles.right}>
        <Text className={styles.poweredBy}>
          © {new Date().getFullYear()} Microsoft Corporation
        </Text>
        
        <div className={styles.divider} />
        
        <Link
          href="https://github.com/blueflightx7/thethingsstack-on-azure"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubLink}
        >
          <GitHubIcon />
          <span>View on GitHub</span>
        </Link>
      </div>
    </footer>
  );
}
