'use client';

import { 
  createContext, 
  useContext, 
  useCallback, 
  useEffect, 
  useState,
  ReactNode,
} from 'react';

interface KioskModeContextValue {
  isKioskMode: boolean;
  isFullscreen: boolean;
  autoCycleEnabled: boolean;
  currentHiveIndex: number;
  toggleKioskMode: () => void;
  toggleAutoCycle: () => void;
  setCurrentHiveIndex: (index: number) => void;
  exitKioskMode: () => void;
}

const KioskModeContext = createContext<KioskModeContextValue | null>(null);

export function useKioskMode() {
  const context = useContext(KioskModeContext);
  if (!context) {
    throw new Error('useKioskMode must be used within KioskModeProvider');
  }
  return context;
}

interface KioskModeProviderProps {
  children: ReactNode;
  /** Auto-cycle interval in milliseconds (default: 15000 = 15 seconds) */
  cycleInterval?: number;
  /** Total number of hives to cycle through */
  totalHives?: number;
  /** Callback when auto-cycle changes hive */
  onHiveChange?: (index: number) => void;
}

export function KioskModeProvider({
  children,
  cycleInterval = 15000,
  totalHives = 0,
  onHiveChange,
}: KioskModeProviderProps) {
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoCycleEnabled, setAutoCycleEnabled] = useState(true);
  const [currentHiveIndex, setCurrentHiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Request fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('Failed to enter fullscreen:', err);
    }
  }, []);

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    try {
      const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    } catch (err) {
      console.warn('Failed to exit fullscreen:', err);
    }
  }, []);

  // Toggle kiosk mode
  const toggleKioskMode = useCallback(() => {
    if (isKioskMode) {
      setIsKioskMode(false);
      void exitFullscreen();
    } else {
      setIsKioskMode(true);
      void enterFullscreen();
    }
  }, [isKioskMode, enterFullscreen, exitFullscreen]);

  // Exit kiosk mode
  const exitKioskMode = useCallback(() => {
    setIsKioskMode(false);
    void exitFullscreen();
  }, [exitFullscreen]);

  // Toggle auto-cycle
  const toggleAutoCycle = useCallback(() => {
    setAutoCycleEnabled(prev => !prev);
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement || 
                   !!(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      setIsFullscreen(isFs);
      
      // Exit kiosk mode if user exits fullscreen manually
      if (!isFs && isKioskMode) {
        setIsKioskMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isKioskMode]);

  // Listen for escape key to exit kiosk mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isKioskMode) {
        exitKioskMode();
      }
      
      // Pause auto-cycle on any key press
      if (isKioskMode && autoCycleEnabled) {
        setIsPaused(true);
        setTimeout(() => setIsPaused(false), cycleInterval * 2);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isKioskMode, autoCycleEnabled, cycleInterval, exitKioskMode]);

  // Pause on user interaction
  useEffect(() => {
    if (!isKioskMode || !autoCycleEnabled) return;

    const handleInteraction = () => {
      setIsPaused(true);
      // Resume after 2x cycle interval of no interaction
      const timeout = setTimeout(() => setIsPaused(false), cycleInterval * 2);
      return () => clearTimeout(timeout);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    document.addEventListener('mousemove', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('mousemove', handleInteraction);
    };
  }, [isKioskMode, autoCycleEnabled, cycleInterval]);

  // Auto-cycle through hives
  useEffect(() => {
    if (!isKioskMode || !autoCycleEnabled || isPaused || totalHives <= 1) {
      return;
    }

    const intervalId = setInterval(() => {
      setCurrentHiveIndex(prev => {
        const next = (prev + 1) % totalHives;
        onHiveChange?.(next);
        return next;
      });
    }, cycleInterval);

    return () => clearInterval(intervalId);
  }, [isKioskMode, autoCycleEnabled, isPaused, totalHives, cycleInterval, onHiveChange]);

  // Hide cursor after inactivity in kiosk mode
  useEffect(() => {
    if (!isKioskMode) {
      document.body.style.cursor = 'auto';
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const hideCursor = () => {
      document.body.style.cursor = 'none';
    };

    const showCursor = () => {
      document.body.style.cursor = 'auto';
      clearTimeout(timeoutId);
      timeoutId = setTimeout(hideCursor, 3000);
    };

    document.addEventListener('mousemove', showCursor);
    timeoutId = setTimeout(hideCursor, 3000);

    return () => {
      document.removeEventListener('mousemove', showCursor);
      clearTimeout(timeoutId);
      document.body.style.cursor = 'auto';
    };
  }, [isKioskMode]);

  const value: KioskModeContextValue = {
    isKioskMode,
    isFullscreen,
    autoCycleEnabled,
    currentHiveIndex,
    toggleKioskMode,
    toggleAutoCycle,
    setCurrentHiveIndex,
    exitKioskMode,
  };

  return (
    <KioskModeContext.Provider value={value}>
      {children}
    </KioskModeContext.Provider>
  );
}
