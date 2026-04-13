/**
 * Collapsible content wrapper for long posts in the timeline.
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/components/posts/collapsible-content.tsx
 * Ported from activities.next #513 / #522 — collapses post content beyond
 * a configurable line limit with a gradient overlay and "Show more" button.
 * Uses ResizeObserver for responsive overflow detection.
 */

'use client';

import { ChevronDown } from 'lucide-react';
import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/utils';

interface CollapsibleContentProps {
  children: ReactNode;
  className?: string;
  maxLines?: number;
}

const LINE_HEIGHT_REM = 1.4375; // ~line height for text-sm leading-relaxed

export const CollapsibleContent: FC<CollapsibleContentProps> = ({
  children,
  className,
  maxLines = 5,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  const maxHeightRem = maxLines * LINE_HEIGHT_REM;

  const checkOverflow = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    const maxHeightPx =
      maxHeightRem *
      parseFloat(getComputedStyle(document.documentElement).fontSize);
    setIsOverflowing(el.scrollHeight > maxHeightPx + 2); // 2px tolerance
  }, [maxHeightRem]);

  useEffect(() => {
    checkOverflow();
  }, [children, checkOverflow]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      checkOverflow();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkOverflow]);

  const needsCollapse = isOverflowing && !isExpanded;

  return (
    <div className="relative">
      <div
        id={contentId}
        ref={contentRef}
        className={cn(className, needsCollapse && 'overflow-hidden')}
        style={needsCollapse ? { maxHeight: `${maxHeightRem}rem` } : undefined}
      >
        {children}
      </div>
      {needsCollapse && (
        <div className="from-background absolute right-0 bottom-0 left-0 flex items-end justify-center bg-gradient-to-t to-transparent pt-8 pb-0">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label="Show more content"
            className="border-border/60 bg-background/80 text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs backdrop-blur-sm transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
          >
            <span>Show more</span>
            <ChevronDown className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
};
