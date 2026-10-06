'use client';

import { Input } from '@mantine/core';

interface JoinedFieldsProps {
  /** The one label above the pair — the two halves state one thing between them. */
  label: string,
  /** The naming half: a blessing, which reads as the label on what follows. */
  left: React.ReactNode,
  /** The number half. */
  right: React.ReactNode,
  /** How the pair divides its width, left first. Defaults to an even split. */
  ratio?: [number, number],
}

/**
 * Two controls drawn as one, the way the game's item screen writes a blessing
 * and its value: `ATK+12`, the name acting as a label on the number rather than
 * as a field of its own. The seam between them is closed in `globals.css`
 * (`.wizda-joined-fields`); this only supplies the flex row, the shared label,
 * and the split.
 *
 * Each half keeps its own `aria-label`, so one visual control is still two
 * controls to a screen reader — which is what it is. Hence a plain `label`
 * string here rather than an `htmlFor` pointing at half of it.
 */
export function JoinedFields({ label, left, right, ratio = [1, 1] }: JoinedFieldsProps) {
  return (
    <Input.Wrapper label={label} size="sm">
      <div className="wizda-joined-fields">
        <div style={{ flex: ratio[0] }}>{left}</div>
        <div style={{ flex: ratio[1] }}>{right}</div>
      </div>
    </Input.Wrapper>
  );
}
