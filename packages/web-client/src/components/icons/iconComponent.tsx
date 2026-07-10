'use client';

import type { IconType } from 'react-icons';

import type { ComponentType, CSSProperties } from 'react';

/**
 * The icon contract the app codes against, satisfied by both Tabler icons and
 * (via {@link gameIcon}) game-icons. Deliberately narrower than either library's
 * props: `stroke` is meaningless for a filled glyph, so it isn't offered.
 */
export interface IconComponentProps {
  size?: number | string,
  /** Any CSS paint — including an SVG paint server, e.g. `url(#some-gradient)`. */
  color?: string,
  className?: string,
  style?: CSSProperties,
}

export type IconComponent = ComponentType<IconComponentProps>;

/**
 * Adapts a `react-icons` game-icon to {@link IconComponent}.
 *
 * `color` is routed to `fill`, not to react-icons' own `color` prop. game-icons
 * are filled silhouettes whose paths carry no `fill` of their own, so they
 * inherit the `fill="currentColor"` that `IconBase` puts on the `<svg>`;
 * overriding that one attribute paints the whole glyph. react-icons' `color`
 * instead lands in `style.color`, which resolves `currentColor` — that works for
 * a plain colour but *silently* drops a paint server, since `url(#…)` is not a
 * valid CSS `color`. Tabler side-steps this by painting its stroke from `color`.
 * Routing to `fill` keeps a rank gradient working across both families.
 */
export function gameIcon(Icon: IconType): IconComponent {
  return function GameIcon({
    size,
    color,
    className,
    style,
  }: IconComponentProps) {
    return (
      <Icon
        size={size}
        fill={color}
        className={className}
        style={style}
      />
    );
  };
}
