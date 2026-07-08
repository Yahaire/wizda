'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { Group, NumberInput, Slider } from '@mantine/core';

import { WizdaEmoji, wizdaSay } from '@/mascot/wizda';

import { MAX_CERTAINTY_PCT, MIN_CERTAINTY_PCT } from './oracle.logic';

interface CertaintySliderProps {
  value: number,
  onChange: (value: number) => void,
}

const AGORA_LINE = "Remember — not even GREAT Agora can guarantee you'll get it!";
const COMMIT_DELAY_MS = 500;

export function CertaintySlider({ value, onChange }: CertaintySliderProps) {
  // Track the control locally so it stays responsive to every movement, but
  // only push the change upward (localStorage + reactivity) once the user
  // pauses — otherwise every pixel of drag / keystroke fires a commit.
  const [local, setLocal] = useState(value);
  // When set via the number box, briefly enable a CSS transition so the slider
  // thumb glides. It stays off during a drag (a transition would lag the thumb).
  const [animate, setAnimate] = useState(false);
  const commitTimer = useRef<number | undefined>(undefined);
  const animateTimer = useRef<number | undefined>(undefined);

  // Reflect external changes (e.g. filters restored from storage).
  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => () => {
    window.clearTimeout(commitTimer.current);
    window.clearTimeout(animateTimer.current);
  }, []);

  // A true 100% is unreachable (the API rejects it), so the top of the track is
  // the 99.99% cap. Cranking all the way up earns Wizda's reality check.
  const handle = (next: number, glide: boolean) => {
    const clamped = Math.min(Math.max(next, MIN_CERTAINTY_PCT), MAX_CERTAINTY_PCT);
    if (clamped >= MAX_CERTAINTY_PCT && local < MAX_CERTAINTY_PCT) {
      wizdaSay(AGORA_LINE, { emoji: WizdaEmoji.info });
    }
    setLocal(clamped);

    if (glide) {
      setAnimate(true);
      window.clearTimeout(animateTimer.current);
      animateTimer.current = window.setTimeout(() => setAnimate(false), 250);
    }

    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => onChange(clamped), COMMIT_DELAY_MS);
  };

  const transition = animate ? 'left 220ms ease, width 220ms ease' : undefined;

  return (
    <Group gap="md" wrap="nowrap" align="center">
      <Slider
        flex={1}
        color="crimson"
        min={MIN_CERTAINTY_PCT}
        max={100}
        step={1}
        value={Math.min(local, 100)}
        onChange={(sliderValue) => handle(sliderValue >= 100 ? MAX_CERTAINTY_PCT : sliderValue, false)}
        label={(sliderValue) => `${sliderValue >= 100 ? MAX_CERTAINTY_PCT : sliderValue}%`}
        styles={{ thumb: { transition }, bar: { transition } }}
      />
      <NumberInput
        w={116}
        value={local}
        onChange={(numberValue) => handle(Number(numberValue) || MIN_CERTAINTY_PCT, true)}
        min={MIN_CERTAINTY_PCT}
        max={MAX_CERTAINTY_PCT}
        step={1}
        clampBehavior="strict"
        decimalScale={2}
        suffix="%"
      />
    </Group>
  );
}
