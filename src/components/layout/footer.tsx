'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import { CATEGORY_META, CATEGORY_ORDER } from '@/config/tools';
import { useLocale, useT } from '@/hooks/use-t';

const ICON_SIZE = 16;

export function Footer() {
  const t = useT();
  const locale = useLocale();

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-10 sm:flex-row sm:justify-between">
        <div className="flex max-w-md flex-col gap-2">
          <p className="text-base font-semibold tracking-tight">Toolbox</p>
          <p className="flex items-start gap-2 text-sm text-muted">
            <ShieldCheck size={ICON_SIZE} className="mt-0.5 shrink-0" aria-hidden />
            {t.footer.privacy}
          </p>
          <p className="text-sm text-muted">{t.footer.rights}</p>
        </div>

        <nav aria-label={t.nav.categories} className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t.nav.categories}</p>
          <ul className="flex flex-col gap-1.5">
            {CATEGORY_ORDER.map((category) => (
              <li key={category}>
                <Link
                  href={`/category/${category}`}
                  className="rounded text-sm text-muted transition-colors hover:text-foreground"
                >
                  {CATEGORY_META[category][locale]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
