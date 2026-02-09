'use client';

import { useEffect, useRef } from 'react';
import fitty from 'fitty';

interface BeliefCardProps {
  text: string;
  onClick?: () => void;
}

export function BeliefCard({ text, onClick }: BeliefCardProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!textRef.current || !measureRef.current) return;
    const el = textRef.current;
    const box = measureRef.current;

    const fit = fitty(el, {
      maxSize: 120,
      minSize: 14,
      multiLine: true,
      observeMutations: false,
    });

    const fitText = () => {
      fit.fit();

      // Fitty optimizes primarily for width. This second pass grows text with wrapping
      // until it reaches the box's height/width constraints.
      el.style.whiteSpace = 'normal';
      el.style.display = 'block';
      el.style.width = '100%';

      let low = Math.max(
        14,
        parseFloat(el.style.fontSize || '') ||
          parseFloat(window.getComputedStyle(el).fontSize) ||
          14
      );
      let high = 120;

      for (let i = 0; i < 8; i += 1) {
        const mid = (low + high) / 2;
        el.style.fontSize = `${mid}px`;
        const fitsBox =
          el.scrollHeight <= box.clientHeight && el.scrollWidth <= box.clientWidth;
        if (fitsBox) {
          low = mid;
        } else {
          high = mid;
        }
      }

      el.style.fontSize = `${Math.max(14, Math.min(low, 120))}px`;
    };

    const raf = requestAnimationFrame(fitText);
    const ro = new ResizeObserver(() => fitText());
    ro.observe(box);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      fit.unsubscribe();
    };
  }, [text]);

  return (
    <div className="belief-square" onClick={onClick}>
      <div ref={measureRef} className="belief-square-measure">
        <div ref={textRef} className="belief-square-text">
          {text}
        </div>
      </div>
    </div>
  );
}
