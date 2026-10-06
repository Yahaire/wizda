'use client';

import { useStrings } from '@/i18n/LanguageProvider';
import {
    Alert, Group, NumberInput, Paper, SegmentedControl, Select, Stack, Switch, Text
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

import {
    EMPTY_SLOT_FORM_STATE, isSlotFilledAtDrop, MAX_BLESSING_SLOTS, milestoneForSlot,
    slotBlessingOptions, SlotDisplayState, slotDisplayState, SlotFormState, SlotShape,
    slotStateProblem, SlotWishState, slotWishState
} from './enhancement.logic';
import { JoinedFields } from './JoinedFields';
import { QualityPicker } from './QualityPicker';

import type { EnhancementReference } from '@shared/api/endpoints/enhancementOdds.models';

interface SlotEditorProps {
  slots: Record<number, SlotFormState>,
  shape: SlotShape,
  reference: EnhancementReference | null,
  onSlotChange: (slot: number, patch: Partial<SlotFormState>) => void,
}

const FILLED = 'filled';
const EMPTY = 'empty';

/**
 * How a row divides its width: what the item shows takes the larger share, the
 * wish beside it the smaller, and both carry a basis wide enough that a narrow
 * form column wraps them onto separate lines instead of crushing them. The form
 * lives in a `md: 5` grid column, so this can't key off the viewport the way
 * `COMPACT_FIELD_BREAKPOINT` does — the column is narrow long before the screen is.
 */
const NOW_COLUMN = { flex: '2 1 190px' };
const WISH_COLUMN = { flex: '1 1 120px' };

/** The blessing/value split inside a joined pair — the name needs the room, the number doesn't. */
const PAIR_RATIO: [number, number] = [2, 1];

/** A slot with nothing to ask and nothing to enter: what it is, and why. */
function SettledSlotRow({ slot, reason }: { slot: number, reason: string }) {
  const strings = useStrings();

  return (
    <Paper withBorder p="sm" radius="sm" style={{ opacity: 0.5 }}>
      <Text size="sm" c="dimmed">
        {strings.enhancement.slotLabel(slot)} — {reason}
      </Text>
    </Paper>
  );
}

/**
 * A value the player hopes a slot reaches. Empty means "any", which is why it
 * carries a placeholder rather than a zero: no floor is a real answer here, and
 * the commonest one.
 */
function WishValueInput({
  label,
  value,
  onChange,
  ariaLabel,
  disabled,
}: {
  label?: string,
  value: number | null,
  onChange: (value: number | null) => void,
  ariaLabel: string,
  disabled?: boolean,
}) {
  const strings = useStrings();

  return (
    <NumberInput
      label={label}
      size="sm"
      min={1}
      value={value ?? ''}
      onChange={(next) => onChange(typeof next === 'number' ? next : null)}
      placeholder={strings.enhancement.wishAnyPlaceholder}
      leftSection={<Text size="sm" c="dimmed">≥</Text>}
      leftSectionWidth={26}
      aria-label={ariaLabel}
      disabled={disabled}
    />
  );
}

/**
 * What the player hopes a still-empty slot ends up holding — both halves open,
 * both starting at "any". The value is held back until a blessing is named
 * because the API's targets are keyed by blessing: "anything, so long as it's
 * at least 12" isn't a question it can be asked.
 */
function WishPair({
  slot,
  slotState,
  reference,
  onChange,
}: {
  slot: number,
  slotState: SlotFormState,
  reference: EnhancementReference | null,
  onChange: (patch: Partial<SlotFormState>) => void,
}) {
  const strings = useStrings();

  return (
    <JoinedFields
      label={strings.enhancement.wishLabel}
      ratio={PAIR_RATIO}
      left={(
        <Select
          size="sm"
          data={slotBlessingOptions(slot, reference)}
          value={slotState.wishBlessingCode}
          onChange={(wishBlessingCode) => onChange({
            wishBlessingCode,
            // A value with no blessing to hang it on can't be sent, so it goes
            // when the blessing does rather than lingering out of sight.
            ...(wishBlessingCode === null && { wishMinValue: null }),
          })}
          placeholder={strings.enhancement.wishBlessingPlaceholder}
          aria-label={strings.enhancement.wishBlessingAriaLabel(slot)}
          searchable
          clearable
        />
      )}
      right={(
        <WishValueInput
          value={slotState.wishMinValue}
          onChange={(wishMinValue) => onChange({ wishMinValue })}
          ariaLabel={strings.enhancement.wishValueAriaLabel(slot)}
          disabled={slotState.wishBlessingCode === null}
        />
      )}
    />
  );
}

/**
 * One slot's row, in whichever of {@link SlotDisplayState}'s three shapes it is
 * currently in: dimmed and guaranteed empty (a stated grade puts it past the
 * piece's last blessing), the blessing/value fields under a note saying what
 * guarantees them, or those same fields behind an Empty/Filled toggle the
 * player can set in any order. See `enhancement.logic.ts` for why those three
 * exhaust it.
 *
 * Crossed with that, {@link SlotWishState} decides what the row can be asked to
 * hope for: an occupied slot's blessing is fixed, so only its value is open; a
 * slot a milestone will still fill is open on both counts; and a slot nothing
 * will touch again is asked nothing, since the number it would be wished
 * against is already on screen beside it.
 */
function SlotRow({
  slot,
  slotState,
  displayState,
  wishState,
  shape,
  reference,
  onChange,
}: {
  slot: number,
  slotState: SlotFormState,
  displayState: SlotDisplayState,
  wishState: SlotWishState,
  shape: SlotShape,
  reference: EnhancementReference | null,
  onChange: (patch: Partial<SlotFormState>) => void,
}) {
  const strings = useStrings();

  const wishable = wishState === SlotWishState.BLESSING_AND_VALUE;

  // Settled empty and staying that way — the one row with neither a question
  // nor a field, and the only one still drawn dimmed.
  if (displayState === SlotDisplayState.GUARANTEED_EMPTY && !wishable) {
    return (
      <SettledSlotRow
        slot={slot}
        reason={strings.enhancement.slotEmptyUntilHint(milestoneForSlot(slot))}
      />
    );
  }

  const mandatory = displayState === SlotDisplayState.MANDATORY;
  const occupied = mandatory || (displayState === SlotDisplayState.OPTIONAL && slotState.filled);

  // Both readings are true of a slot the piece came with that has *also* passed
  // its own milestone, but that milestone only boosted what was already there —
  // so where the blessing came from is the one worth saying.
  const mandatoryReason = isSlotFilledAtDrop(slot, shape)
    ? strings.enhancement.slotFilledAtDropHint(
      strings.vocab.gradeName[shape.initialGrade as 1 | 2 | 3 | 4 | 5],
    )
    : strings.enhancement.slotFilledByMilestoneHint(milestoneForSlot(slot));

  const setFilled = (filled: boolean) => {
    onChange(filled ? { filled: true } : { ...EMPTY_SLOT_FORM_STATE, filled: false });
  };

  // What sits opposite the slot's name: the question, when there is one to ask,
  // and otherwise the reason there isn't.
  const headerAside = (() => {
    if (displayState === SlotDisplayState.OPTIONAL) {
      return (
        <SegmentedControl
          size="xs"
          value={slotState.filled ? FILLED : EMPTY}
          onChange={(next) => setFilled(next === FILLED)}
          data={[
            { value: EMPTY, label: strings.enhancement.emptyOption },
            { value: FILLED, label: strings.enhancement.filledOption },
          ]}
        />
      );
    }
    const reason = mandatory
      ? mandatoryReason
      : strings.enhancement.slotFillsAtHint(milestoneForSlot(slot));
    return <Text size="xs" c="dimmed" ta="right">{reason}</Text>;
  })();

  return (
    <Paper withBorder p="sm" radius="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text fw={600} size="sm">{strings.enhancement.slotLabel(slot)}</Text>
          {headerAside}
        </Group>

        {occupied && (
          <>
            <Group gap="sm" wrap="wrap" align="flex-end">
              <div style={NOW_COLUMN}>
                <JoinedFields
                  label={strings.enhancement.nowFieldLabel}
                  ratio={PAIR_RATIO}
                  left={(
                    <Select
                      size="sm"
                      data={slotBlessingOptions(slot, reference)}
                      value={slotState.blessingCode}
                      onChange={(blessingCode) => onChange({ blessingCode })}
                      aria-label={strings.enhancement.slotBlessingAriaLabel(slot)}
                      searchable
                      allowDeselect={false}
                    />
                  )}
                  right={(
                    <NumberInput
                      size="sm"
                      min={1}
                      value={slotState.value ?? ''}
                      onChange={(next) => onChange({ value: typeof next === 'number' ? next : null })}
                      aria-label={strings.enhancement.slotValueAriaLabel(slot)}
                    />
                  )}
                />
              </div>

              <div style={WISH_COLUMN}>
                {wishState === SlotWishState.VALUE_ONLY ? (
                  <WishValueInput
                    label={strings.enhancement.wishLabel}
                    value={slotState.wishMinValue}
                    onChange={(wishMinValue) => onChange({ wishMinValue })}
                    ariaLabel={strings.enhancement.wishValueAriaLabel(slot)}
                  />
                ) : (
                  <Text size="xs" c="dimmed">{strings.enhancement.slotFinalHint}</Text>
                )}
              </div>
            </Group>

            <Switch
              size="sm"
              label={strings.enhancement.planRefineButton}
              checked={slotState.planRefine}
              onChange={(event) => onChange({
                planRefine: event.currentTarget.checked,
                ...(!event.currentTarget.checked && {
                  isRefined: null,
                  planRefineStoneQuality: null,
                }),
              })}
            />

            {slotState.planRefine && (
              <Stack gap="xs" pl="md">
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm">{strings.enhancement.alreadyRefinedQuestion}</Text>
                  <SegmentedControl
                    size="xs"
                    value={
                      slotState.isRefined === null
                        ? ''
                        : (slotState.isRefined ? 'yes' : 'no')
                    }
                    onChange={(next) => onChange({ isRefined: next === 'yes' })}
                    data={[
                      { value: 'no', label: strings.enhancement.noLabel },
                      { value: 'yes', label: strings.enhancement.yesLabel },
                    ]}
                  />
                </Group>

                {slotState.isRefined === true && (
                  <Text size="xs" c="yellow.5">{strings.enhancement.alreadyRefinedBlockedNote}</Text>
                )}

                {slotState.isRefined === false && (
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm">{strings.enhancement.refineStoneQualityLabel}</Text>
                    <QualityPicker
                      size="xs"
                      value={slotState.planRefineStoneQuality}
                      onChange={(planRefineStoneQuality) => onChange({ planRefineStoneQuality })}
                      ariaLabel={strings.enhancement.refineStoneQualityLabel}
                    />
                  </Group>
                )}
              </Stack>
            )}
          </>
        )}

        {/* An empty slot a milestone will still fill: nothing to transcribe, but
            everything left to hope for. */}
        {!occupied && wishable && (
          <WishPair
            slot={slot}
            slotState={slotState}
            reference={reference}
            onChange={onChange}
          />
        )}
      </Stack>
    </Paper>
  );
}

/**
 * All 4 slots — each one both a transcription of the item screen and the wish
 * for what it becomes, in the game's own layout: the blessing reads as a label
 * on its value, and what the player wants sits beside what they have. With the
 * initial grade stated, the shape is settled outright and no row asks whether
 * it holds a blessing; with it left at "Not sure" the player marks Empty/Filled
 * themselves, in whatever order matches their item screen — slot 3 before slot
 * 1 is fine. See `enhancement.logic.ts`'s `slotDisplayState` for that branch and
 * `slotWishState` for what each row can be asked to hope for. A gap that leaves
 * isn't blocked field-by-field; it's caught by `slotStateProblem` and surfaced
 * below instead.
 */
export function SlotEditor({ slots, shape, reference, onSlotChange }: SlotEditorProps) {
  const strings = useStrings();
  const problem = slotStateProblem(slots, shape);

  return (
    <Stack gap="md">
      <div>
        <Text fw={600}>{strings.enhancement.slotsHeading}</Text>
        <Text size="sm" c="dimmed">{strings.enhancement.slotsCaption}</Text>
      </div>
      <Stack gap="xs">
        {Array.from({ length: MAX_BLESSING_SLOTS }, (_unused, index) => index + 1).map((slot) => (
          <SlotRow
            key={slot}
            slot={slot}
            slotState={slots[slot] ?? EMPTY_SLOT_FORM_STATE}
            displayState={slotDisplayState(slot, slots, shape)}
            wishState={slotWishState(slot, slots, shape)}
            shape={shape}
            reference={reference}
            onChange={(patch) => onSlotChange(slot, patch)}
          />
        ))}
      </Stack>
      {problem && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
          {problem.message}
        </Alert>
      )}
    </Stack>
  );
}
