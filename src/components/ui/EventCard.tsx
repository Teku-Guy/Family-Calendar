'use client';

import React from 'react';

type Props = {
  title?: string;
  where?: string;
  color?: string; // accepts #RRGGBB or CSS color
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  height?: number; // height in pixels for smart truncation
  isCondensed?: boolean; // whether to hide location for short events
};

// Convert a color to an RGBA string with alpha. Supports #RRGGBB; falls back to CSS color.
function withAlpha(color: string, alpha: number) {
  if (!color) return `rgba(99, 102, 241, ${alpha})`; // fallback to indigo
  const m = color.match(/^#?([0-9a-fA-F]{6})$/);
  if (m) {
    const hex = m[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // If it's already a named/rgb/hsl color, use a default translucent indigo tint for non-hex inputs
  return `rgba(99, 102, 241, ${alpha})`; // default translucent indigo tint for non-hex inputs
}

// Calculate luminance for contrast detection
function getLuminance(hex: string): number {
  const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return 0.5; // default mid-range

  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;

  // sRGB luminance formula
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// Get text color based on background luminance
function getTextColor(bgColor: string): string {
  const luminance = getLuminance(bgColor);
  // If background is dark (low luminance), use light text
  return luminance < 0.5 ? 'text-white/90' : 'text-black/80';
}

export default function EventCard({
  title = '(No title)',
  where,
  color = '#6366F1',
  onClick,
  className = '',
  height,
  isCondensed = false,
}: Props) {
  const bg = withAlpha(color, 0.15);
  const textColorClass = getTextColor(color);

  // Smart condensing based on height
  const shouldCondense = isCondensed || (height !== undefined && height < 40);
  const showLocation = where && !shouldCondense;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title}${where ? `, ${where}` : ''}`}
      className={`group w-full rounded-lg border border-white/15 text-left outline-none transition-all hover:border-white/30 hover:shadow-lg active:scale-[0.98] touch-manipulation overflow-hidden ${textColorClass} ${className}`}
      style={{ backgroundColor: bg }}
    >
      <div className="px-2 py-1.5 md:px-2.5 md:py-2 min-h-[44px] flex items-start h-full">
        <div className="flex items-start gap-1.5 md:gap-2 w-full min-h-0">
          <span
            className="mt-1 inline-block h-2 w-2 md:h-2.5 md:w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="truncate text-[clamp(0.75rem,1.4vw,0.9rem)] font-semibold leading-tight">
              {title}
            </div>
            {showLocation && (
              <div className="truncate text-[clamp(0.65rem,1vw,0.75rem)] opacity-70 mt-0.5 flex items-center gap-1">
                <svg className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <span className="truncate">{where}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="sr-only">View event details</div>
    </button>
  );
}