import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Paper,
  Title,
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

/**
 * Visual system: "achromatic ledger". Neutral chrome, a near-black primary, flat 1px-bordered
 * surfaces, tight radii, no resting shadows. Colour comes from the cover art and from status.
 */

/** Neutral palette: shade 6 is the near-black primary fill; the lighter shades carry chips and hovers. */
const ink: MantineColorsTuple = [
  '#f6f6f6',
  '#ececec',
  '#d9d9d9',
  '#bcbcbc',
  '#8f8f8f',
  '#6b6b6b',
  '#141414',
  '#0a0a0a',
  '#000000',
  '#000000',
];

/** The one warm accent, reserved for status that needs a glance: on loan, due soon. */
const amber: MantineColorsTuple = [
  '#fff6e5',
  '#fde9c2',
  '#fbd488',
  '#f6b94a',
  '#ee9d1c',
  '#d57f0c',
  '#b24d09',
  '#923f08',
  '#743207',
  '#5a2606',
];

export const theme = createTheme({
  primaryColor: 'ink',
  primaryShade: 6,
  autoContrast: true,
  colors: { ink, amber },
  fontFamily: 'var(--font-geist-sans), system-ui, -apple-system, "Segoe UI", sans-serif',
  fontFamilyMonospace: 'var(--font-geist-mono), ui-monospace, "Cascadia Mono", monospace',
  headings: {
    fontFamily: 'var(--font-geist-sans), system-ui, -apple-system, "Segoe UI", sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '24px', lineHeight: '1.25' },
      h2: { fontSize: '20px', lineHeight: '1.3' },
      h3: { fontSize: '18px', lineHeight: '1.3' },
      h4: { fontSize: '16px', lineHeight: '1.35' },
      h5: { fontSize: '14px', lineHeight: '1.4' },
      h6: { fontSize: '13px', lineHeight: '1.4' },
    },
  },
  fontSizes: { xs: '12px', sm: '14px', md: '14px', lg: '16px', xl: '18px' },
  radius: { xs: '4px', sm: '6px', md: '8px', lg: '8px', xl: '12px' },
  defaultRadius: 'sm',
  spacing: { xs: '8px', sm: '12px', md: '16px', lg: '24px', xl: '32px' },
  components: {
    Title: Title.extend({ defaultProps: { fw: 600 } }),
    Button: Button.extend({ defaultProps: { size: 'sm', fw: 500 } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { variant: 'subtle', color: 'gray' } }),
    Paper: Paper.extend({ defaultProps: { radius: 'md', shadow: undefined } }),
    Card: Card.extend({ defaultProps: { radius: 'md', shadow: undefined } }),
    Badge: Badge.extend({
      defaultProps: { variant: 'light', color: 'ink', radius: 'xs' },
      styles: { root: { textTransform: 'none', fontWeight: 500, letterSpacing: 0 } },
      // Nothing under 11px, and sentence-case labels read better small.
      vars: (_theme, props) => ({
        root: {
          '--badge-fz': props.size === 'xs' ? '11px' : '12px',
          '--badge-height': props.size === 'xs' ? '18px' : '22px',
        },
      }),
    }),
  },
});

/** Text, borders and the page ground, tuned for contrast (secondary text reaches 4.5:1). */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-dimmed': '#5f5f5f',
    '--mantine-color-placeholder': '#6b6b6b',
    '--mantine-color-default-border': '#d4d4d4',
    '--app-ground': '#f4f3f1',
    '--app-border': '#e6e4e0',
    '--app-rule': '#efede9',
  },
  dark: {
    '--mantine-color-dimmed': '#a8a8a8',
    '--mantine-color-placeholder': '#949494',
    // The primary inverts in dark mode: a near-white fill with a near-black label.
    '--mantine-primary-color-filled': '#f2f2f2',
    '--mantine-primary-color-filled-hover': '#ffffff',
    '--mantine-primary-color-contrast': '#0a0a0a',
    // Neutral chips become pale tints instead of black boxes.
    '--mantine-color-ink-light': 'rgba(255, 255, 255, 0.10)',
    '--mantine-color-ink-light-hover': 'rgba(255, 255, 255, 0.16)',
    '--mantine-color-ink-light-color': '#e6e6e6',
    '--app-ground': '#1a1a1a',
    '--app-border': '#333333',
    '--app-rule': '#2a2a2a',
  },
});
