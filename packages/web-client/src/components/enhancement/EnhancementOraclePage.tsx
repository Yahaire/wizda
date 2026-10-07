'use client';

import { useEffect, useMemo, useState } from 'react';

import { ENHANCEMENT_ORACLE_NAME } from '@/app/app.constants';
import { useDetail } from '@/components/detail/DetailProvider';
import { PageTitle } from '@/components/PageTitle';
import { useStrings } from '@/i18n/LanguageProvider';
import { api, ApiError, MaintenanceError } from '@/services/api';
import { Box, Button, Grid, Paper, Stack, Text } from '@mantine/core';
import { IconWand } from '@tabler/icons-react';

import {
    buildEnhancementQuery, buildReferenceParams, canCalculate, DEFAULT_ENHANCEMENT_FORM_STATE,
    EMPTY_SLOT_FORM_STATE, EnhancementFormState, isInitialGradeUnknown, isPieceReady,
    reconcileFormState, SlotFormState
} from './enhancement.logic';
import { EnhancementResult } from './EnhancementResult';
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
  const { equipment: equipmentList } = useDetail();

  const [state, setState] = useState<EnhancementFormState>(DEFAULT_ENHANCEMENT_FORM_STATE);
  const [reference, setReference] = useState<EnhancementReference | null>(null);
  const [computed, setComputed] = useState<ComputedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every write goes through `reconcileFormState`: grade, level and a slot's own
  // fields all move which blessings the piece displays, and any of them can turn
  // an empty slot's wish into one no milestone can grant.
  const patch = (change: Partial<EnhancementFormState>) => {
    setState((current) => reconcileFormState({ ...current, ...change }));
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

  const calculate = async () => {
    const query = buildEnhancementQuery(state);
    if (!query || !canCalculate(state)) {
      return;
    }
    setLoading(true);
    setError(null);
    setComputed(null);
    try {
      const fresh = await api.enhancementOdds(query);
      setComputed({ query: JSON.stringify(query), result: fresh });
    } catch (thrown) {
      if (thrown instanceof MaintenanceError) {
        return; // the global MaintenanceGate already covers this
      }
      setError(thrown instanceof ApiError ? thrown.message : strings.enhancement.loadError);
    } finally {
      setLoading(false);
    }
  };

  // The piece behind the form's English key, for the previews' name, icon and
  // tint. A linear scan of the catalogue per change is cheap next to the
  // dropdown's own row model over the same list.
  const item = useMemo(
    () => equipmentList?.find((candidate) => candidate.name === state.equipment) ?? null,
    [equipmentList, state.equipment],
  );

  const ready = isPieceReady(state);
  const gradeUnknown = isInitialGradeUnknown(state);
  const stale = computed !== null && computed.query !== JSON.stringify(buildEnhancementQuery(state));
  const outcome = computed !== null && !stale ? computed.result.slots : undefined;

  return (
    <Stack gap="lg">
      <div>
        <PageTitle adornment={<PreviewBadge />}>{ENHANCEMENT_ORACLE_NAME}</PageTitle>
        <Text c="dimmed">{strings.enhancement.tagline}</Text>
      </div>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, [PREVIEW_BREAKPOINT]: 5 }}>
          <Stack gap="lg">
            <PieceForm state={state} onChange={patch} equipmentList={equipmentList} />

            {ready && (
              <Paper withBorder p="lg" radius="md">
                <Stack gap="lg">
                  <SlotEditor
                    slots={state.slots}
                    shape={state}
                    reference={reference}
                    onSlotChange={setSlot}
                  />

                  <Button
                    size="md"
                    fullWidth
                    color="crimson"
                    loading={loading}
                    disabled={!canCalculate(state)}
                    leftSection={<IconWand size={18} />}
                    onClick={calculate}
                  >
                    {strings.enhancement.calculateButton}
                  </Button>
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
              <PiecePreview state={state} item={item} outcome={outcome} />
            </Box>

            <Paper withBorder p="lg" radius="md">
              <EnhancementResult
                loading={loading}
                error={error}
                result={computed?.result ?? null}
                gradeUnknown={gradeUnknown}
                stale={stale}
                narrowPreview={ready && item !== null && (
                  <Box hiddenFrom={PREVIEW_BREAKPOINT}>
                    <WantCard state={state} item={item} outcome={outcome} />
                  </Box>
                )}
              />
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
