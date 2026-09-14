import type { Metadata } from 'next';

import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { DataSettings } from '@/components/settings/data-settings';
import { getMessages } from '@/config/i18n';
import { SITE_NAME } from '@/config/site';
import { readPreferences } from '@/lib/cookies.server';

export const metadata: Metadata = {
  title: `ตั้งค่า — ${SITE_NAME}`,
  // Nothing here is content; it only reflects this browser's own data.
  robots: { index: false, follow: true },
};

export default async function SettingsPage() {
  const { locale } = await readPreferences();
  const t = getMessages(locale).settings;

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <h1 className="text-title font-semibold">{t.title}</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.appearance}</h2>
        <AppearanceSettings />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.data}</h2>
        <DataSettings />
      </section>
    </div>
  );
}
