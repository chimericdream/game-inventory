'use client';

import {
  ActionIcon,
  Anchor,
  Button,
  type ActionIconProps,
  type AnchorProps,
  type ButtonProps,
} from '@mantine/core';
import Link from 'next/link';

/*
 * Mantine's `component={Link}` passes a function as a prop, which server components cannot do.
 * Use these from server components instead.
 */

export function LinkButton({ href, ...props }: ButtonProps & { href: string }) {
  return <Button component={Link} href={href} {...props} />;
}

export function LinkIconButton({
  href,
  ...props
}: ActionIconProps & { href: string; 'aria-label': string; children?: React.ReactNode }) {
  return <ActionIcon component={Link} href={href} {...props} />;
}

export function LinkAnchor({
  href,
  ...props
}: AnchorProps & { href: string; children?: React.ReactNode }) {
  return <Anchor component={Link} href={href} {...props} />;
}
