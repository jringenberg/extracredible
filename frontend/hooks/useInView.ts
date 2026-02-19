'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const DEFAULT_OPTIONS: IntersectionObserverInit = {
  rootMargin: '50px',
  threshold: 0,
};

/**
 * Returns true once the element has entered the viewport (with optional rootMargin).
 * Uses IntersectionObserver; only triggers once.
 */
export function useInView(options: IntersectionObserverInit = {}): [boolean, (node: HTMLSpanElement | null) => void] {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setRef = useCallback(
    (node: HTMLSpanElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node) return;
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observerRef.current?.disconnect();
            observerRef.current = null;
          }
        },
        { ...DEFAULT_OPTIONS, ...options }
      );
      observerRef.current.observe(node);
    },
    [options.root, options.rootMargin, options.threshold]
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [inView, setRef];
}
