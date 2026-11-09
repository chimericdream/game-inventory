import {
  ActionIcon,
  Badge,
  Button,
  Card,
  NumberInput,
  Paper,
  Select,
  Textarea,
  TextInput,
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

/**
 * Visual system: "The Shelf". A warm stone ground, forest green for actions, and berry for anything
 * out on loan or wrong. Titles are set in Fraunces, everything else in Figtree. Colour in the
 * interface stays quiet so the covers carry it. See docs/design/the-shelf for the reference.
 */

/** Primary. Shade 6 is the light-mode fill; shade 3 is the lighter fill used in dark mode. */
const forest: MantineColorsTuple = [
  '#eaf4ef',
  '#cfe3d8',
  '#a6d0be',
  '#62c4a0',
  '#3f9f80',
  '#2a8068',
  '#1c6b56',
  '#165745',
  '#104334',
  '#0b2f24',
];

/** Loans and errors. Shade 6 on light grounds, shade 3 on dark ones. */
const berry: MantineColorsTuple = [
  '#fbeef1',
  '#efd2d9',
  '#e3b0bd',
  '#f0909f',
  '#c9566f',
  '#b6405b',
  '#a3304d',
  '#8a2641',
  '#701d35',
  '#561529',
];

/** Warm neutrals for chips, hovers and rules. */
const stone: MantineColorsTuple = [
  '#f4f4ee',
  '#e7e7e0',
  '#dcdcd3',
  '#cfcfc5',
  '#b9b9ae',
  '#9a9a8f',
  '#5a655f',
  '#3f4a45',
  '#1d2824',
  '#121816',
];

const SANS = 'var(--font-figtree), system-ui, -apple-system, "Segoe UI", sans-serif';
const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif';

export const theme = createTheme({
  primaryColor: 'forest',
  primaryShade: { light: 6, dark: 3 },
  autoContrast: true,
  // Mantine's red is the error colour in alerts, inputs and destructive buttons; make it berry too.
  colors: { forest, berry, stone, red: berry },
  fontFamily: SANS,
  fontFamilyMonospace: 'ui-monospace, "Cascadia Mono", "Segoe UI Mono", monospace',
  headings: {
    fontFamily: SERIF,
    fontWeight: '700',
    sizes: {
      h1: { fontSize: 'clamp(34px, 4vw, 52px)', lineHeight: '1.02' },
      h2: { fontSize: '28px', lineHeight: '1.15' },
      h3: { fontSize: '22px', lineHeight: '1.2' },
      h4: { fontSize: '18px', lineHeight: '1.3' },
      h5: { fontSize: '16px', lineHeight: '1.35' },
      h6: { fontSize: '14px', lineHeight: '1.4' },
    },
  },
  fontSizes: { xs: '12px', sm: '14px', md: '16px', lg: '17px', xl: '20px' },
  radius: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '999px' },
  defaultRadius: 'md',
  spacing: { xs: '8px', sm: '12px', md: '16px', lg: '24px', xl: '32px' },
  components: {
    Button: Button.extend({ defaultProps: { radius: 'xl', fw: 600 } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { variant: 'subtle', color: 'gray' } }),
    Paper: Paper.extend({ defaultProps: { radius: 'lg', shadow: undefined } }),
    Card: Card.extend({ defaultProps: { radius: 'lg', shadow: undefined } }),
    TextInput: TextInput.extend({ defaultProps: { radius: 'md' } }),
    NumberInput: NumberInput.extend({ defaultProps: { radius: 'md' } }),
    Select: Select.extend({ defaultProps: { radius: 'md' } }),
    Textarea: Textarea.extend({ defaultProps: { radius: 'md' } }),
    Badge: Badge.extend({
      defaultProps: { variant: 'light', color: 'forest', radius: 'xl' },
      styles: { root: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 } },
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

/**
 * The ground, surfaces and text for both colour schemes, tuned for contrast (secondary text reaches
 * 4.5:1 on every surface it sits on). `--app-*` variables are for the bespoke CSS modules;
 * `--mantine-color-*` overrides make Mantine's own components follow the same palette.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--app-serif': SERIF,
    '--app-radius-card': '16px',
  },
  light: {
    '--mantine-color-body': '#f4f4ee',
    '--mantine-color-text': '#1d2824',
    '--mantine-color-dimmed': '#55605a',
    '--mantine-color-placeholder': '#5f6a64',
    '--mantine-color-default': '#f4f4ee',
    '--mantine-color-default-hover': '#dcdcd3',
    '--mantine-color-default-border': '#c4c4b9',
    '--app-ground': '#e7e7e0',
    '--app-surface': '#f4f4ee',
    '--app-sunk': '#dcdcd3',
    '--app-ink': '#1d2824',
    '--app-muted': '#55605a',
    '--app-tint': '#cfe3d8',
    '--app-accent': '#1c6b56',
    '--app-on-accent': '#f4f4ee',
    '--app-plank': '#a7794a',
    '--app-loan': '#a3304d',
    '--app-loan-tint': '#efd2d9',
    '--app-border': '#d5d5cb',
    '--app-rule': '#dcdcd3',
  },
  dark: {
    '--mantine-color-body': '#1b2420',
    '--mantine-color-text': '#e9eee8',
    '--mantine-color-dimmed': '#9aa89f',
    '--mantine-color-placeholder': '#8c9b92',
    '--mantine-color-default': '#1b2420',
    '--mantine-color-default-hover': '#243c33',
    '--mantine-color-default-border': '#33443c',
    '--app-ground': '#121816',
    '--app-surface': '#1b2420',
    '--app-sunk': '#0d1210',
    '--app-ink': '#e9eee8',
    '--app-muted': '#9aa89f',
    '--app-tint': '#243c33',
    '--app-accent': '#62c4a0',
    '--app-on-accent': '#0d1a15',
    '--app-plank': '#6e5033',
    '--app-loan': '#f0909f',
    '--app-loan-tint': '#41222b',
    '--app-border': '#2c3a34',
    '--app-rule': '#26322d',
  },
});
