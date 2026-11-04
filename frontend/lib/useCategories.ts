'use client';

import { useEffect, useState } from 'react';
import { api } from './api';
import { CATEGORIES, type CategoryDef } from './categories';

let cache: CategoryDef[] | null = null;
let inflight: Promise<CategoryDef[]> | null = null;

/** Merge the server's active categories (names, order, visibility) onto our local icon definitions. */
function load(): Promise<CategoryDef[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api<{ id: number; slug: string; name: string }[]>('/categories')
      .then((rows) => {
        const out = rows
          .map((r) => {
            const local = CATEGORIES.find((c) => c.id === r.id || c.slug === r.slug);
            return local ? { ...local, name: r.name } : null;
          })
          .filter(Boolean) as CategoryDef[];
        cache = out.length ? out : CATEGORIES;
        return cache;
      })
      .catch(() => CATEGORIES)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Categories currently visible to the public (admins can hide or rename them). */
export function useCategories(): CategoryDef[] {
  const [cats, setCats] = useState<CategoryDef[]>(cache || CATEGORIES);
  useEffect(() => {
    let alive = true;
    load().then((c) => { if (alive) setCats(c); });
    return () => { alive = false; };
  }, []);
  return cats;
}
