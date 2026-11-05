'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { ENHANCEMENT_ORACLE_NAME } from '@/app/app.constants';
import { useDetail } from '@/components/detail/DetailProvider';
import { PageTitle } from '@/components/PageTitle';
import { PreparingVeil } from '@/components/PreparingVeil';
import { useStrings, useWizda } from '@/i18n/LanguageProvider';
import { wizdaConfirm } from '@/mascot/wizda';
import { api, ApiError, MaintenanceError } from '@/services/api';
import { Box, Grid, Paper, Stack, Text } from '@mantine/core';

import { CalculateButton } from './CalculateButton';
import {
    blockerField, buildEnhancementQuery, buildReferenceParams, calculateBlockers, canCalculate,
    DEFAULT_ENHANCEMENT_FORM_STATE, EMPTY_SLOT_FORM_STATE, EnhancementFormState, forgetLastCalculated,
    isInitialGradeUnknown, isPieceReady, readLastCalculated, reconcileFormState, setAsideWishSlots,
    SlotFormState, storeLastCalculated
} from './enhancement.logic';
import { EnhancementResult } from './EnhancementResult';
import { revealSlotField } from './missingFields';
import { PieceForm } from './PieceForm';
import { PreviewBadge } from './PreviewBadge';
import { PiecePreview, PREVIEW_BREAKPOINT, WantCard } from './PiecePreview';
import { SlotEditor } from './SlotEditor';

import type { EnhancementOddsResult, EnhancementReference } from '@shared/api/endpoints/enhancementOdds.models';

/**
 * A result and the exact question it answered. The question is kept as the
 * serialized request so a later form state can be checked against it by
 * value: a result is *current* only while the form would send that same
 * request again. The form moving on doesn't discard the result — a wish
 * nudged and nudged back is current again with no round trip — it only
 * stops the result being drawn as the answer to the form in front of the
 * player.
 */
interface ComputedResult {
  query: string,
  result: EnhancementOddsResult,
}

export function EnhancementOraclePage() {
  const strings = useStrings();
  const wizda = useWizda();
  const { equipment: equipmentList, status: listStatus } = useDetail();

  const [state, setState] = useState<EnhancementFormState>(DEFAULT_ENHANCEMENT_FORM_STATE);
  // False until the mount effect below has had its chance to restore the last
  // calculated piece — storage can't be read during the prerender, so the
  // first render always shows the empty form.
  const [seeded, setSeeded] = useState(false);
  const [reference, setReference] = useState<EnhancementReference | null>(null);
  const [computed, setComputed] = useState<ComputedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set by a press of Calculate while something is still missing, and only
  // then: nothing is flagged before the player has tried. Once set, the marks
  // follow the form live — each clears as its field is filled.
  const [revealMissing, setRevealMissing] = useState(false);
  const slotsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  // Set by a press of Calculate only — the mount restore answers a piece the
  // player hasn't asked about yet this visit, so it leaves the page where it is.
  const pendingScrollRef = useRef(false);

  // Every write goes through `reconcileFormState`: grade, level and a slot's own
  // fields all move which blessings the piece displays, and any of them can turn
  // an empty slot's wish into one no milestone can grant.
  //
  // The piece section's writes can also hide wishes filled in below it — a
  // stated grade fills a slot, a lowered target puts one out of reach. Those are
  // kept, not cleared, but nothing on the rows says so; Wizda does, and offers
  // the way back.
  const patch = (change: Partial<EnhancementFormState>) => {
    const before = state;
    const after = reconcileFormState({ ...before, ...change });
    setState(after);
    const setAside = setAsideWishSlots(before, after);
    if (setAside.length === 0) {
      return;
    }
    const undo = () => setState((current) => {
      // Untouched since: the whole form goes back, any wish `reconcileFormState`
      // cleared included. Otherwise only what this change moved, so later edits stay.
      if (current === after) {
        return before;
      }
      const reverted = Object.fromEntries(
        Object.keys(change).map((key) => [key, before[key as keyof EnhancementFormState]]),
      );
      return reconcileFormState({ ...current, ...reverted });
    });
    const slotNames = strings.common.joinList(setAside.map(strings.enhancement.slotLabel), 'and');
    wizdaConfirm(
      wizda.enhancement.wishesSetAside(slotNames),
      undo,
      {
        confirmLabel: wizda.enhancement.undoLabel,
        dismissLabel: wizda.enhancement.keepChangeLabel,
      },
    );
  };

  const setSlot = (slot: number, change: Partial<SlotFormState>) => {
    setState((current) => reconcileFormState({
      ...current,
      slots: {
        ...current.slots,
        [slot]: { ...(current.slots[slot] ?? EMPTY_SLOT_FORM_STATE), ...change },
      },
    }));
  };

  // Undone afterwards rather than confirmed first: one click in the common case,
  // and a slip costs nothing. Undo hands back the form, its answer and the
  // remembered piece together — forgotten here, or the next visit would restore
  // what the player just cleared.
  const reset = () => {
    const before = { state, computed, error };
    const remembered = readLastCalculated();
    setState(DEFAULT_ENHANCEMENT_FORM_STATE);
    setComputed(null);
    setError(null);
    setRevealMissing(false);
    forgetLastCalculated();
    const undo = () => {
      setState(before.state);
      setComputed(before.computed);
      setError(before.error);
      if (remembered) {
        storeLastCalculated(remembered);
      }
    };
    wizdaConfirm(
      wizda.enhancement.formReset,
      undo,
      { confirmLabel: wizda.enhancement.undoLabel },
    );
  };

  // Fetch the piece's reference data once (equipment, quality) is known —
  // used to filter each slot's blessing options and to catch a no-value-group
  // piece early. Refetches whenever the pair changes; no caching layer, since
  // this is one small request per pair.
  useEffect(() => {
    const params = buildReferenceParams(state);
    if (!params) {
      setReference(null);
      return;
    }
    let cancelled = false;
    api.enhancementReference(params)
      .then((next) => {
        if (!cancelled) {
          setReference(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReference(null);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.equipment, state.quality]);

  // Takes the form to ask about rather than reading `state`, so the mount
  // effect can run it on a just-restored form its own closure can't see yet.
  const calculate = async (asked: EnhancementFormState) => {
    const query = buildEnhancementQuery(asked);
    if (!query || !canCalculate(asked)) {
      return;
    }
    // A clean run starts the "tried it" clock over, so a field the next edit
    // makes required isn't flagged before the player has pressed again.
    setRevealMissing(false);
    setLoading(true);
    setError(null);
    setComputed(null);
    try {
      const fresh = await api.enhancementOdds(query);
      setComputed({ query: JSON.stringify(query), result: fresh });
      storeLastCalculated(asked);
    } catch (thrown) {
      if (thrown instanceof MaintenanceError) {
        return; // the global MaintenanceGate already covers this
      }
      setError(thrown instanceof ApiError ? thrown.message : strings.enhancement.loadError);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to the answer once a pressed Calculate settles, on the Junk Oracle's
  // terms (its `pendingScrollRef`). An error is an answer too — it's drawn in the
  // same panel — while a maintenance bounce leaves nothing there to look at.
  useEffect(() => {
    if (loading || !pendingScrollRef.current) {
      return;
    }
    pendingScrollRef.current = false;
    if (computed === null && error === null) {
      return;
    }
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, computed, error]);

  // Bring back the piece this player last calculated, answer and all — most
  // visits re-ask about the same piece after enhancing it a little further.
  // Recalculated rather than stored with its result, so a reseed's rates or a
  // deploy's result shape can never be replayed stale.
  useEffect(() => {
    const restored = readLastCalculated();
    setSeeded(true);
    if (!restored) {
      return;
    }
    setState(restored);
    void calculate(restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The piece behind the form's English key, for the previews' name, icon and
  // tint. A linear scan of the catalogue per change is cheap next to the
  // dropdown's own row model over the same list.
  const item = useMemo(
    () => equipmentList?.find((candidate) => candidate.name === state.equipment) ?? null,
    [equipmentList, state.equipment],
  );

  const blockers = calculateBlockers(state);

  // Send the player to the first thing missing. A form-wide blocker has no
  // field to go to; its message under the button is the whole answer.
  const showBlocked = () => {
    setRevealMissing(true);
    const [first] = blockers;
    const field = first ? blockerField(first) : null;
    if (!first || first.slot === null || field === null) {
      return;
    }
    revealSlotField(slotsRef.current, first.slot, field);
  };

  const ready = isPieceReady(state);
  const gradeUnknown = isInitialGradeUnknown(state);
  const stale = computed !== null && computed.query !== JSON.stringify(buildEnhancementQuery(state));
  const outcome = computed !== null && !stale ? computed.result.slots : undefined;

  // The "still filling in" scrim, on the Junk Oracle's terms (see its
  // `preparedRef`): the restore above, then — only if it named a piece — the
  // catalogue that turns its English key into the name the player picked.
  // Latched, so a language switch re-pulling the lists doesn't bring it back.
  const preparedRef = useRef(false);
  if (
    !preparedRef.current
    && seeded
    && (state.equipment === null || listStatus === 'ready' || listStatus === 'error')
  ) {
    preparedRef.current = true;
  }

  return (
    <Stack gap="lg">
      <div>
        <PageTitle adornment={<PreviewBadge />}>{ENHANCEMENT_ORACLE_NAME}</PageTitle>
        <Text c="dimmed">{strings.enhancement.tagline}</Text>
      </div>

      <PreparingVeil preparing={!preparedRef.current}>
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, [PREVIEW_BREAKPOINT]: 5 }}>
            <Stack gap="lg">
              <PieceForm
                state={state}
                onChange={patch}
                equipmentList={equipmentList}
                onReset={reset}
              />

              {ready && (
                <Paper ref={slotsRef} withBorder p="lg" radius="md">
                  <Stack gap="lg">
                    <SlotEditor
                      slots={state.slots}
                      shape={state}
                      reference={reference}
                      missingBlockers={revealMissing ? blockers : []}
                      onSlotChange={setSlot}
                    />

                    <CalculateButton
                      blockers={blockers}
                      explain={revealMissing}
                      loading={loading}
                      onCalculate={() => {
                        pendingScrollRef.current = true;
                        void calculate(state);
                      }}
                      onBlocked={showBlocked}
                    />
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, [PREVIEW_BREAKPOINT]: 7 }}>
            <Stack gap="lg">
              {/* Beside the form only — see PREVIEW_BREAKPOINT for why a narrow
                  screen gets the WANT face inside the result instead. */}
              <Box visibleFrom={PREVIEW_BREAKPOINT}>
                <PiecePreview state={state} item={item} outcome={outcome} slotRates={reference?.slots} />
              </Box>

              <Paper ref={resultsRef} withBorder p="lg" radius="md" className="wizda-scroll-clear-header">
                <EnhancementResult
                  loading={loading}
                  error={error}
                  result={computed?.result ?? null}
                  gradeUnknown={gradeUnknown}
                  stale={stale}
                  narrowPreview={ready && item !== null && (
                    <Box hiddenFrom={PREVIEW_BREAKPOINT}>
                      <WantCard state={state} item={item} outcome={outcome} slotRates={reference?.slots} />
                    </Box>
                  )}
                />
              </Paper>
            </Stack>
          </Grid.Col>
        </Grid>
      </PreparingVeil>
    </Stack>
  );
}
