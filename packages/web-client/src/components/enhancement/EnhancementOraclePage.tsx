'use client';

import { useEffect, useState } from 'react';

import { ENHANCEMENT_ORACLE_NAME } from '@/app/app.constants';
import { useDetail } from '@/components/detail/DetailProvider';
import { PageTitle } from '@/components/PageTitle';
import { useStrings } from '@/i18n/LanguageProvider';
import { api, ApiError, MaintenanceError } from '@/services/api';
import { Button, Grid, Paper, Stack, Text } from '@mantine/core';
import { IconWand } from '@tabler/icons-react';

import {
    buildEnhancementQuery, buildReferenceParams, canCalculate, DEFAULT_ENHANCEMENT_FORM_STATE,
    EMPTY_SLOT_FORM_STATE, EnhancementFormState, isInitialGradeUnknown, isPieceReady,
    reconcileFormState, SlotFormState
} from './enhancement.logic';
import { EnhancementResult } from './EnhancementResult';
import { PieceForm } from './PieceForm';
import { SlotEditor } from './SlotEditor';

import type { EnhancementOddsResult, EnhancementReference } from '@shared/api/endpoints/enhancementOdds.models';

export function EnhancementOraclePage() {
  const strings = useStrings();
  const { equipment: equipmentList } = useDetail();

  const [state, setState] = useState<EnhancementFormState>(DEFAULT_ENHANCEMENT_FORM_STATE);
  const [reference, setReference] = useState<EnhancementReference | null>(null);
  const [result, setResult] = useState<EnhancementOddsResult | null>(null);
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
    setResult(null);
    try {
      const fresh = await api.enhancementOdds(query);
      setResult(fresh);
    } catch (thrown) {
      if (thrown instanceof MaintenanceError) {
        return; // the global MaintenanceGate already covers this
      }
      setError(thrown instanceof ApiError ? thrown.message : strings.enhancement.loadError);
    } finally {
      setLoading(false);
    }
  };

  const ready = isPieceReady(state);
  const gradeUnknown = isInitialGradeUnknown(state);

  return (
    <Stack gap="lg">
      <div>
        <PageTitle>{ENHANCEMENT_ORACLE_NAME}</PageTitle>
        <Text c="dimmed">{strings.enhancement.tagline}</Text>
      </div>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 5 }}>
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

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper withBorder p="lg" radius="md" h="100%">
            <EnhancementResult
              loading={loading}
              error={error}
              result={result}
              gradeUnknown={gradeUnknown}
            />
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
