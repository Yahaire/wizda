'use client';

import { GRADE_HEX } from '@/components/gear/gearDisplays';
import { IconSingleSelect } from '@/components/select/IconSingleSelect';
import { useStrings } from '@/i18n/LanguageProvider';
import { GRADES } from '@shared/domain/grade';
import { IconCircleFilled, IconHelp } from '@tabler/icons-react';

import { NOT_SURE } from './enhancement.logic';

import type { SelectOptionIcon } from '@/components/select/selectOptions';

interface GradeSelectProps {
  /** null = "Not sure" — a first-class answer, distinct from White (grade 1). */
  value: number | null,
  onChange: (value: number | null) => void,
  disabled?: boolean,
}

interface GradeOption {
  /** {@link NOT_SURE} or `String(grade.value)`. */
  value: string,
  label: string,
}

const getGradeValue = (option: GradeOption) => option.value;
const getGradeLabel = (option: GradeOption) => option.label;

function gradeIcon(option: GradeOption): SelectOptionIcon {
  if (option.value === NOT_SURE) {
    return { icon: IconHelp };
  }
  return {
    icon: IconCircleFilled,
    color: GRADE_HEX[Number(option.value)],
    // White is near-white and would dissolve into the field without a rim.
    className: 'wizda-icon-outline',
  };
}

/**
 * Tri-state initial-grade dropdown: "Not sure" plus White…Red. Unlike the Junk
 * Oracle's `GradeFilter` (a "this and up" floor), this asks for the piece's
 * exact grade at drop — and, unlike quality, leaving it unanswered is a real,
 * costless option (see `docs/calculation/enhancement.md` — `initialGrade` never
 * moves the odds), so "Not sure" is an option in the list rather than the
 * absence of one. The field is therefore never empty and never needs a
 * placeholder.
 */
export function GradeSelect({ value, onChange, disabled }: GradeSelectProps) {
  const strings = useStrings();

  const data: GradeOption[] = [
    { value: NOT_SURE, label: strings.enhancement.notSure },
    ...GRADES.map((grade) => ({
      value: String(grade.value),
      label: strings.vocab.gradeName[grade.value as 1 | 2 | 3 | 4 | 5],
    })),
  ];

  return (
    <IconSingleSelect
      data={data}
      value={value !== null ? String(value) : NOT_SURE}
      onChange={(next) => onChange(next === NOT_SURE ? null : Number(next))}
      getValue={getGradeValue}
      getLabel={getGradeLabel}
      getIcon={gradeIcon}
      disabled={disabled}
      emptyMessage={strings.enhancement.noMatchesLabel}
      ariaLabel={strings.enhancement.initialGradeLabel}
    />
  );
}
