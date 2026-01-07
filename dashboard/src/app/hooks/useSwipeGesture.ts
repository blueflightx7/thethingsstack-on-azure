'use client';

import { useCallback, useRef, useState, useEffect, TouchEvent } from 'react';

export interface SwipeGestureOptions {
  /** Minimum distance in pixels to trigger a swipe */
  threshold?: number;
  /** Maximum time in milliseconds for the swipe gesture */
  timeout?: number;
  /** Enable/disable the gesture */
  enabled?: boolean;
}

export interface SwipeGestureCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export interface SwipeGestureResult {
  /** Attach these to the element you want to enable swipe gestures on */
  handlers: {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: (e: TouchEvent) => void;
  };
  /** Whether a swipe is currently in progress */
  isSwiping: boolean;
  /** Current swipe direction if swiping */
  swipeDirection: 'left' | 'right' | 'up' | 'down' | null;
  /** Current swipe distance */
  swipeDistance: number;
}

export function useSwipeGesture(
  callbacks: SwipeGestureCallbacks,
  options: SwipeGestureOptions = {}
): SwipeGestureResult {
  const {
    threshold = 50,
    timeout = 500,
    enabled = true,
  } = options;

  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
  const [swipeDistance, setSwipeDistance] = useState(0);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    setIsSwiping(true);
    setSwipeDirection(null);
    setSwipeDistance(0);
  }, [enabled]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine primary direction
    if (absX > absY) {
      setSwipeDirection(deltaX > 0 ? 'right' : 'left');
      setSwipeDistance(absX);
    } else {
      setSwipeDirection(deltaY > 0 ? 'down' : 'up');
      setSwipeDistance(absY);
    }
  }, [enabled]);

  const onTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStartRef.current) {
      setIsSwiping(false);
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const elapsed = Date.now() - touchStartRef.current.time;

    // Check if gesture is within time limit
    if (elapsed < timeout) {
      // Horizontal swipe
      if (absX > absY && absX >= threshold) {
        if (deltaX > 0) {
          callbacks.onSwipeRight?.();
        } else {
          callbacks.onSwipeLeft?.();
        }
      }
      // Vertical swipe
      else if (absY > absX && absY >= threshold) {
        if (deltaY > 0) {
          callbacks.onSwipeDown?.();
        } else {
          callbacks.onSwipeUp?.();
        }
      }
    }

    touchStartRef.current = null;
    setIsSwiping(false);
    setSwipeDirection(null);
    setSwipeDistance(0);
  }, [enabled, threshold, timeout, callbacks]);

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    isSwiping,
    swipeDirection,
    swipeDistance,
  };
}

/**
 * Hook to detect touch device capabilities
 */
export function useTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  }, []);

  return isTouch;
}

/**
 * Hook to detect screen size category for responsive layouts
 * Includes special detection for LED wall aspect ratios (32:9 and 48:9)
 */
export type ScreenSize = 
  | 'mobile' 
  | 'tablet' 
  | 'desktop' 
  | 'tv' 
  | 'theatre' 
  | 'theatre-2v'  // 32:9 aspect ratio (2 vignette LED wall)
  | 'theatre-3v'; // 48:9 aspect ratio (3 vignette LED wall)

export interface ScreenInfo {
  size: ScreenSize;
  aspectRatio: number;
  isUltrawide: boolean;
  vignetteCount: 2 | 3 | null;
  width: number;
  height: number;
}

export function useScreenSize(): ScreenSize {
  const [size, setSize] = useState<ScreenSize>('desktop');

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspectRatio = width / height;
      
      // LED Wall Detection (based on aspect ratio)
      // 48:9 = 5.33 aspect ratio (3 vignette - 3x 16:9 side-by-side)
      // 32:9 = 3.56 aspect ratio (2 vignette - 2x 16:9 side-by-side)
      // Standard 16:9 = 1.78 aspect ratio
      
      // 3 Vignette (48:9): aspect ratio ~5.0-5.7
      if (aspectRatio >= 4.8 && aspectRatio <= 5.8 && width >= 5760) {
        setSize('theatre-3v');
      }
      // 2 Vignette (32:9): aspect ratio ~3.4-3.8
      else if (aspectRatio >= 3.3 && aspectRatio <= 4.0 && width >= 3840) {
        setSize('theatre-2v');
      }
      // Theatre mode: very large displays (4K+)
      else if (width >= 3840 && height >= 2160) {
        setSize('theatre');
      }
      // TV: 1080p and above, typically wider than tall
      else if (width >= 1920 || (width >= 1280 && height >= 720)) {
        setSize('tv');
      }
      // Desktop: standard monitors
      else if (width >= 1024) {
        setSize('desktop');
      }
      // Tablet: medium screens
      else if (width >= 768) {
        setSize('tablet');
      }
      // Mobile: small screens
      else {
        setSize('mobile');
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return size;
}

/**
 * Extended hook that provides detailed screen information
 * Useful for theatre mode layout decisions
 */
export function useScreenInfo(): ScreenInfo {
  const [info, setInfo] = useState<ScreenInfo>({
    size: 'desktop',
    aspectRatio: 16/9,
    isUltrawide: false,
    vignetteCount: null,
    width: 1920,
    height: 1080,
  });

  useEffect(() => {
    const updateInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspectRatio = width / height;
      
      let size: ScreenSize = 'desktop';
      let vignetteCount: 2 | 3 | null = null;
      
      // 3 Vignette (48:9)
      if (aspectRatio >= 4.8 && aspectRatio <= 5.8 && width >= 5760) {
        size = 'theatre-3v';
        vignetteCount = 3;
      }
      // 2 Vignette (32:9)
      else if (aspectRatio >= 3.3 && aspectRatio <= 4.0 && width >= 3840) {
        size = 'theatre-2v';
        vignetteCount = 2;
      }
      // Theatre mode: 4K+
      else if (width >= 3840 && height >= 2160) {
        size = 'theatre';
      }
      // TV: 1080p+
      else if (width >= 1920 || (width >= 1280 && height >= 720)) {
        size = 'tv';
      }
      else if (width >= 1024) {
        size = 'desktop';
      }
      else if (width >= 768) {
        size = 'tablet';
      }
      else {
        size = 'mobile';
      }
      
      setInfo({
        size,
        aspectRatio,
        isUltrawide: aspectRatio > 2.5,
        vignetteCount,
        width,
        height,
      });
    };

    updateInfo();
    window.addEventListener('resize', updateInfo);
    return () => window.removeEventListener('resize', updateInfo);
  }, []);

  return info;
}

export default useSwipeGesture;
