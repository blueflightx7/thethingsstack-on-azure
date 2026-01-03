'use client';

import { makeStyles, shorthands } from '@griffel/react';
import { Text } from '@fluentui/react-text';
import { Tooltip } from '@fluentui/react-tooltip';
import { tokens } from '@fluentui/react-theme';
import {
  CircleFilled,
  CloudArrowUp20Regular,
  CloudOff20Regular,
  CloudSync20Regular,
} from '@fluentui/react-icons';

export type ConnectionState = 'connected' | 'reconnecting' | 'polling' | 'offline';

interface ConnectionStatusProps {
  state: ConnectionState;
  lastUpdated?: Date | null;
  isAdmin?: boolean;
  technicalDetails?: string;
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
  },
  dot: {
    fontSize: '8px',
  },
  connected: {
    color: '#107C10', // Microsoft green
  },
  reconnecting: {
    color: '#FFB900', // Microsoft yellow
    '@keyframes pulse': {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.4 },
    },
    animationName: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.4 },
    },
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
  },
  polling: {
    color: '#0078D4', // Azure blue
  },
  offline: {
    color: '#D13438', // Microsoft red
  },
  text: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  icon: {
    fontSize: '16px',
  },
});

function formatTimeAgo(date: Date | null | undefined): string {
  if (!date) return '';
  
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleTimeString();
}

const stateConfig: Record<ConnectionState, {
  label: string;
  adminLabel: string;
  Icon: typeof CloudArrowUp20Regular;
  colorClass: 'connected' | 'reconnecting' | 'polling' | 'offline';
}> = {
  connected: {
    label: 'Live',
    adminLabel: 'WebSocket connected',
    Icon: CloudArrowUp20Regular,
    colorClass: 'connected',
  },
  reconnecting: {
    label: 'Reconnecting...',
    adminLabel: 'WebSocket reconnecting',
    Icon: CloudSync20Regular,
    colorClass: 'reconnecting',
  },
  polling: {
    label: 'Live (polling)',
    adminLabel: 'HTTP polling @ 30s',
    Icon: CloudSync20Regular,
    colorClass: 'polling',
  },
  offline: {
    label: 'Offline',
    adminLabel: 'No connection',
    Icon: CloudOff20Regular,
    colorClass: 'offline',
  },
};

export function ConnectionStatus({
  state,
  lastUpdated,
  isAdmin = false,
  technicalDetails,
}: ConnectionStatusProps) {
  const styles = useStyles();
  const config = stateConfig[state];
  const Icon = config.Icon;
  
  const timeAgo = formatTimeAgo(lastUpdated);
  
  // User-friendly message
  const friendlyMessage = state === 'connected' 
    ? `Live data${timeAgo ? ` • Updated ${timeAgo}` : ''}`
    : state === 'reconnecting'
    ? 'Reconnecting to hive sensors...'
    : state === 'polling'
    ? `Live updates${timeAgo ? ` • Updated ${timeAgo}` : ''}`
    : `Working offline${timeAgo ? ` • Last update: ${timeAgo}` : ''}`;
  
  // Admin tooltip content
  const adminTooltip = isAdmin 
    ? `${config.adminLabel}${technicalDetails ? `\n${technicalDetails}` : ''}`
    : undefined;
  
  const content = (
    <div className={styles.container}>
      <CircleFilled className={`${styles.dot} ${styles[config.colorClass]}`} />
      <Icon className={`${styles.icon} ${styles[config.colorClass]}`} />
      <Text className={styles.text}>{friendlyMessage}</Text>
    </div>
  );
  
  if (adminTooltip) {
    return (
      <Tooltip content={adminTooltip} relationship="description">
        {content}
      </Tooltip>
    );
  }
  
  return content;
}
