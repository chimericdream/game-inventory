'use client';

import { useEffect, useRef, useState } from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import classes from './Library.module.css';

/**
 * The big "Do we own...?" box. It writes the `q` parameter (after a short pause while typing) and
 * leaves every other filter alone. The URL stays the single source of truth.
 */
export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlValue = params.get('q') ?? '';
  const [value, setValue] = useState(urlValue);
  const lastPushed = useRef(urlValue);

  // Follow the URL when it changes from elsewhere (back button, clearing filters).
  useEffect(() => {
    if (urlValue !== lastPushed.current) {
      lastPushed.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  useEffect(() => {
    if (value === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = value;
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set('q', value);
      else next.delete('q');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(timer);
  }, [value, params, pathname, router]);

  return (
    <div className={classes.search}>
      <IconSearch size={20} aria-hidden className={classes.searchIcon} />
      <input
        type="search"
        role="searchbox"
        aria-label="Search titles"
        placeholder="Do we own…?"
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        autoComplete="off"
        enterKeyHint="search"
      />
      {value && (
        <button
          type="button"
          className={classes.searchClear}
          aria-label="Clear search"
          onClick={() => setValue('')}
        >
          <IconX size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
