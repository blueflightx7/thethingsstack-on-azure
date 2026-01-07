'use client';

import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { Button } from '@fluentui/react-button';
import {
  Play24Regular,
  Pause24Regular,
  SpeakerMute24Regular,
  Speaker224Regular,
  FullScreenMaximize24Regular,
} from '@fluentui/react-icons';
import { useState, useEffect, useRef } from 'react';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    ...shorthands.overflow('hidden'),
  },

  // Header
  header: {
    ...shorthands.padding('24px', '32px'),
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  titleLight: {
    color: '#1a1a1a',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  controlButton: {
    minWidth: '48px',
    minHeight: '48px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    ...shorthands.borderRadius('8px'),
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
  },
  controlButtonLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    color: '#1a1a1a',
    ':hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.12)',
    },
  },

  // Content
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('24px'),
    ...shorthands.gap('24px'),
    ...shorthands.overflow('auto'),
  },

  // Video section
  videoSection: {
    flex: 2,
    minHeight: '200px',
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: '20px',
    ...shorthands.overflow('hidden'),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.gap('16px'),
    color: 'rgba(255, 255, 255, 0.5)',
  },
  videoIcon: {
    fontSize: '80px',
    opacity: 0.6,
  },
  videoLabel: {
    fontSize: '20px',
    fontWeight: 500,
  },
  videoSubLabel: {
    fontSize: '14px',
    opacity: 0.7,
  },
  liveBadge: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    ...shorthands.padding('8px', '16px'),
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    ...shorthands.borderRadius('20px'),
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
  },
  liveIndicator: {
    width: '10px',
    height: '10px',
    backgroundColor: '#E81123',
    borderRadius: '50%',
    animation: 'blink 1s ease-in-out infinite',
  },

  // Audio section
  audioSection: {
    flex: 1,
    minHeight: '120px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    ...shorthands.padding('24px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
  },
  audioSectionLight: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  audioHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  audioTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('10px'),
  },
  audioTitleLight: {
    color: '#1a1a1a',
  },
  audioStatus: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  audioStatusLight: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#107C10',
  },

  // Waveform visualization
  waveformContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.gap('3px'),
    minHeight: '60px',
  },
  waveformBar: {
    width: '4px',
    backgroundColor: '#FFB900',
    borderRadius: '2px',
    transition: 'height 0.1s ease',
  },
  waveformBarActive: {
    backgroundColor: '#0078D4',
  },

  // Audio info
  audioInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  audioInfoLight: {
    color: 'rgba(0, 0, 0, 0.4)',
  },
});

interface MediaZoneProps {
  hiveName?: string;
  isDark: boolean;
  showVideo?: boolean;
  showAudio?: boolean;
}

export function MediaZone({ 
  hiveName = 'Apiary', 
  isDark, 
  showVideo = true, 
  showAudio = true 
}: MediaZoneProps) {
  const styles = useStyles();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const animationRef = useRef<number>();

  // Generate animated waveform data
  useEffect(() => {
    const bars = 40;
    let phase = 0;
    
    const animate = () => {
      phase += 0.1;
      const data = Array.from({ length: bars }, (_, i) => {
        const base = Math.sin((i * 0.3) + phase) * 0.3;
        const noise = Math.random() * 0.4;
        return Math.max(0.1, Math.min(1, 0.5 + base + noise));
      });
      setWaveformData(data);
      animationRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      animate();
    } else {
      // Static waveform when paused
      setWaveformData(Array.from({ length: bars }, () => 0.15));
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={mergeClasses(styles.header, !isDark && styles.headerLight)}>
        <span className={mergeClasses(styles.title, !isDark && styles.titleLight)}>
          🎥 Live Feed
        </span>
        <div className={styles.controls}>
          <Button
            className={mergeClasses(styles.controlButton, !isDark && styles.controlButtonLight)}
            icon={isPlaying ? <Pause24Regular /> : <Play24Regular />}
            onClick={() => setIsPlaying(!isPlaying)}
          />
          <Button
            className={mergeClasses(styles.controlButton, !isDark && styles.controlButtonLight)}
            icon={isMuted ? <SpeakerMute24Regular /> : <Speaker224Regular />}
            onClick={() => setIsMuted(!isMuted)}
          />
          <Button
            className={mergeClasses(styles.controlButton, !isDark && styles.controlButtonLight)}
            icon={<FullScreenMaximize24Regular />}
          />
        </div>
      </div>

      <div className={styles.content}>
        {/* Video Section */}
        {showVideo && (
          <div className={styles.videoSection}>
            <div className={styles.liveBadge}>
              <div className={styles.liveIndicator} />
              LIVE
            </div>
            <div className={styles.videoPlaceholder}>
              <span className={styles.videoIcon}>📹</span>
              <span className={styles.videoLabel}>{hiveName} Camera</span>
              <span className={styles.videoSubLabel}>Video feed placeholder</span>
            </div>
          </div>
        )}

        {/* Audio Section */}
        {showAudio && (
          <div className={mergeClasses(styles.audioSection, !isDark && styles.audioSectionLight)}>
            <div className={styles.audioHeader}>
              <span className={mergeClasses(styles.audioTitle, !isDark && styles.audioTitleLight)}>
                🔊 Hive Audio
              </span>
              <div className={mergeClasses(styles.audioStatus, !isDark && styles.audioStatusLight)}>
                <div className={styles.statusDot} style={{ backgroundColor: isPlaying ? '#107C10' : '#8A8886' }} />
                {isPlaying ? 'Streaming' : 'Paused'}
              </div>
            </div>

            {/* Waveform */}
            <div className={styles.waveformContainer}>
              {waveformData.map((height, i) => (
                <div
                  key={i}
                  className={mergeClasses(
                    styles.waveformBar,
                    i % 3 === 0 && styles.waveformBarActive
                  )}
                  style={{ 
                    height: `${height * 100}%`,
                    opacity: isMuted ? 0.3 : 1,
                  }}
                />
              ))}
            </div>

            {/* Audio Info */}
            <div className={mergeClasses(styles.audioInfo, !isDark && styles.audioInfoLight)}>
              <span>Microphone 1 • 44.1kHz</span>
              <span>{isMuted ? 'Muted' : 'Active'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
