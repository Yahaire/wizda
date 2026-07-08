'use client';

import {
  createTheme,
  type MantineColorsTuple,
} from '@mantine/core';

/**
 * Deep crimson echoing the red "Wizardry" logo. Used as the primary accent.
 */
const crimson: MantineColorsTuple = [
  '#ffe9ea',
  '#ffd1d2',
  '#f5a0a2',
  '#ec6d70',
  '#e44446',
  '#e02a2d',
  '#df1c20',
  '#c60f15',
  '#b10510',
  '#9b0008',
];

/**
 * Tuned dark scale — index 0 is the lightest (parchment-ish text), index 9 the
 * near-black background, matching the game's murky dungeon art. Mantine reads
 * `dark[0]` for default dark text and `dark[7]` for the body background.
 */
const dark: MantineColorsTuple = [
  '#e8e2d6',
  '#c5bfb4',
  '#a09a90',
  '#7c766d',
  '#585349',
  '#3d3933',
  '#2b2823',
  '#141210',
  '#0f0d0c',
  '#0a0908',
];

export const wizdaTheme = createTheme({
  primaryColor: 'crimson',
  primaryShade: {
    light: 6,
    dark: 6,
  },
  colors: {
    crimson,
    dark,
  },
  fontFamily: 'var(--font-body), system-ui, sans-serif',
  fontFamilyMonospace: 'var(--font-mono), ui-monospace, monospace',
  headings: {
    fontFamily: 'var(--font-display), Georgia, serif',
  },
  defaultRadius: 'md',
});
