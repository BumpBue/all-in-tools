import type { MetadataRoute } from 'next';

import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from '@/config/site';
import { THEME_COLOR_LIGHT } from '@/lib/theme';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE.th,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION.th,
    lang: 'th',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: THEME_COLOR_LIGHT,
    theme_color: THEME_COLOR_LIGHT,
    categories: ['utilities', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'ค้นหาเครื่องมือ',
        short_name: 'ค้นหา',
        url: '/search',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
