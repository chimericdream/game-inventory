'use client';

import { Anchor, Button, type AnchorProps, type ButtonProps } from '@mantine/core';
import Link from 'next/link';

/*
 * Mantine's `component={Link}` passes a function as a prop, which server components cannot do.
 * Use these from server components instead.
 */

export function LinkButton({ href, ...props }: ButtonProps & { href: string }) {
  return <Button component={Link} href={href} {...props} />;
}

export function LinkAnchor({
  href,
  ...props
}: AnchorProps & { href: string; children?: React.ReactNode }) {
  return <Anchor component={Link} href={href} {...props} />;
}
