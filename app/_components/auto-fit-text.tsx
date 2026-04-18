"use client";

import { useLayoutEffect, useRef, useState } from "react";

type AutoFitTextProps = {
  children: React.ReactNode;
  className?: string;
  minPx?: number;
  maxPx: number;
  // Adds top padding in em units to reserve headroom for scripts with upper marks.
  topInsetEm?: number;
};

export function AutoFitText({
  children,
  className,
  minPx = 14,
  maxPx,
  topInsetEm = 0,
}: AutoFitTextProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [fontSize, setFontSize] = useState(maxPx);

  useLayoutEffect(() => {
    function fitText() {
      const container = containerRef.current;
      const text = textRef.current;

      if (!container || !text) {
        return;
      }

      text.style.fontSize = `${maxPx}px`;
      text.style.transform = "scaleX(1)";

      const widthAtMax = text.getBoundingClientRect().width;
      const containerWidth = container.clientWidth;

      if (widthAtMax <= 0 || containerWidth <= 0) {
        return;
      }

      const ideal = (containerWidth / widthAtMax) * maxPx;
      const bounded = Math.max(minPx, Math.min(maxPx, ideal));

      text.style.fontSize = `${bounded}px`;
      const widthAtBounded = text.getBoundingClientRect().width;

      if (widthAtBounded > containerWidth && widthAtBounded > 0) {
        // If minPx is still too large, permit additional shrink to prevent clipping.
        const forcedFit = (containerWidth / widthAtBounded) * bounded;
        setFontSize(Math.max(1, forcedFit));
        return;
      }

      setFontSize(bounded);
    }

    fitText();

    const observer = new ResizeObserver(() => {
      fitText();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [children, minPx, maxPx]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <span
        ref={textRef}
        style={{
          fontSize: `${fontSize}px`,
          paddingTop: topInsetEm > 0 ? `${topInsetEm}em` : undefined,
          willChange: "font-size",
        }}
        className={`inline-block whitespace-nowrap leading-none ${className ?? ""}`}
      >
        {children}
      </span>
    </div>
  );
}
