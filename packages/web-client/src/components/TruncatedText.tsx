'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Text,
  Tooltip,
  type TextProps,
} from '@mantine/core';

interface TruncatedTextProps extends TextProps {
  children: string,
}

/**
 * A single-line, ellipsised Text that only shows a tooltip with the full value
 * when it is actually clipped. The tooltip opens on hover (desktop) and on tap
 * (mobile), so a cut-off name is always recoverable.
 */
export function TruncatedText({ children, ...textProps }: TruncatedTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => setOverflowing(element.scrollWidth > element.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);

  return (
    <Tooltip
      label={children}
      disabled={!overflowing}
      multiline
      maw={320}
      withArrow
      events={{ hover: true, focus: true, touch: true }}
    >
      <Text ref={ref} truncate {...textProps}>{children}</Text>
    </Tooltip>
  );
}
