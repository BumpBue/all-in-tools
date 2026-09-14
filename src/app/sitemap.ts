import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/config/site';
import { CATEGORY_ORDER, TOOLS } from '@/config/tools';

const HOME_PRIORITY = 1;
const CATEGORY_PRIORITY = 0.8;
const READY_TOOL_PRIORITY = 0.7;
const PLANNED_TOOL_PRIORITY = 0.3;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: 'weekly',
      priority: HOME_PRIORITY,
    },
    ...CATEGORY_ORDER.map((category) => ({
      url: `${SITE_URL}/category/${category}`,
      changeFrequency: 'weekly' as const,
      priority: CATEGORY_PRIORITY,
    })),
    ...TOOLS.map((tool) => ({
      url: `${SITE_URL}/tools/${tool.slug}`,
      changeFrequency: 'monthly' as const,
      priority:
        tool.status === 'ready' ? READY_TOOL_PRIORITY : PLANNED_TOOL_PRIORITY,
    })),
  ];
}
