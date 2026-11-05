'use client';

import { EquipmentSingleSelect } from '@/components/oracle/EquipmentSingleSelect';
import { COMPACT_FIELD_BREAKPOINT } from '@/components/oracle/FieldSwap';
import { FilterField } from '@/components/oracle/FilterField';
import { useStrings } from '@/i18n/LanguageProvider';
import { Button, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconRotate } from '@tabler/icons-react';

import { CurrentLevelField } from './CurrentLevelField';
import {
    EnhancementFormState, isFormUntouched, normalizeTargetLevel, targetLevelOptions
} from './enhancement.logic';
import { GradeSelect } from './GradeSelect';
import { QualitySelect } from './QualitySelect';
import { TargetLevelField } from './TargetLevelField';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

/** How the two-up rows share their width. One rule, so every field turns together. */
const FIELD_COLUMNS = { base: 1, [COMPACT_FIELD_BREAKPOINT]: 2 };

/**
 * The field's value beside its name. Dropped past the swap, where the number box
 * and the dropdown each state their own value and this would only repeat it.
 */
function LevelReadout({ level }: { level: number }) {
  return (
    <Text span fz="sm" fw={600} hiddenFrom={COMPACT_FIELD_BREAKPOINT}>
      {`+${level}`}
    </Text>
  );
}

interface PieceFormProps {
  state: EnhancementFormState,
  onChange: (patch: Partial<EnhancementFormState>) => void,
  /**
   * The **full** equipment catalogue from `useDetail()` — deliberately *not*
   * filtered to `sources.length > 0` the way the Junk Oracle's own use of
   * `EquipmentSelect` is. A player may already own a piece that never dropped
   * from junk (crafted, event, quest), and this tool describes a piece they
   * have, not one junk could produce.
   */
  equipmentList: EquipmentListItem[] | null,
  /** Puts the whole form back to a first visit's — the slots below included. */
  onReset: () => void,
}

/**
 * Equipment, quality, initial grade, and the two enhancement-level fields,
 * under a heading that carries the form's one Reset. No field has a reset of
 * its own: each holds a single answer, changed by picking another, and the
 * equipment's own Reset sat where it read as the whole form's anyway.
 */
export function PieceForm({
  state,
  onChange,
  equipmentList,
  onReset,
}: PieceFormProps) {
  const strings = useStrings();

  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="lg">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600}>{strings.enhancement.pieceHeading}</Text>
          {!isFormUntouched(state) && (
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              leftSection={<IconRotate size={14} />}
              aria-label={strings.enhancement.resetFormAriaLabel}
              onClick={onReset}
            >
              {strings.common.clear}
            </Button>
          )}
        </Group>

        <FilterField
          label={strings.enhancement.equipmentLabel}
          description={strings.enhancement.equipmentDescription}
        >
          <EquipmentSingleSelect
            data={equipmentList ?? []}
            value={state.equipment}
            onChange={(equipment) => onChange({ equipment })}
            disabled={!equipmentList}
            ariaLabel={strings.enhancement.equipmentLabel}
          />
        </FilterField>

        <SimpleGrid cols={FIELD_COLUMNS} spacing="lg">
          <FilterField
            label={strings.enhancement.qualityLabel}
            description={strings.enhancement.qualityDescription}
          >
            <QualitySelect
              value={state.quality}
              onChange={(quality) => onChange({ quality })}
            />
          </FilterField>

          <FilterField
            label={strings.enhancement.initialGradeLabel}
            description={strings.enhancement.initialGradeDescription}
          >
            <GradeSelect
              value={state.initialGrade}
              answered={state.gradeAnswered}
              onChange={(initialGrade) => onChange({ initialGrade, gradeAnswered: true })}
            />
          </FilterField>
        </SimpleGrid>

        <SimpleGrid cols={FIELD_COLUMNS} spacing="lg">
          <FilterField
            label={strings.enhancement.currentLevelLabel}
            description={strings.enhancement.currentLevelDescription}
            readout={<LevelReadout level={state.enhancementLevel} />}
          >
            <CurrentLevelField
              value={state.enhancementLevel}
              onChange={(enhancementLevel) => onChange({
                enhancementLevel,
                // The target's choices are derived from this level, so moving it
                // can strand the stored target off the list — in either
                // direction. `normalizeTargetLevel` puts it back; the field
                // itself doesn't need to know why.
                targetEnhancementLevel: normalizeTargetLevel(
                  state.targetEnhancementLevel,
                  enhancementLevel,
                ),
              })}
              ariaLabel={strings.enhancement.currentLevelLabel}
            />
          </FilterField>

          {/* At +20 the only target left is standing still, so there is nothing
              to ask and the field goes away rather than offering one option. */}
          {targetLevelOptions(state.enhancementLevel).length > 1 && (
            <FilterField
              label={strings.enhancement.targetLevelLabel}
              description={strings.enhancement.targetLevelDescription}
              readout={<LevelReadout level={state.targetEnhancementLevel} />}
            >
              <TargetLevelField
                value={state.targetEnhancementLevel}
                onChange={(targetEnhancementLevel) => onChange({ targetEnhancementLevel })}
                currentLevel={state.enhancementLevel}
                ariaLabel={strings.enhancement.targetLevelLabel}
              />
            </FilterField>
          )}
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}
