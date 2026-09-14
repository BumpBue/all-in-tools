import type { CategoryMeta, ToolCategory } from '@/types/tool';

export const CATEGORY_ORDER: readonly ToolCategory[] = [
  'productivity',
  'finance',
  'developer',
  'design',
];

export const CATEGORY_META: Record<ToolCategory, CategoryMeta> = {
  productivity: {
    th: 'เพิ่มประสิทธิภาพ',
    en: 'Productivity',
    icon: 'Rocket',
    color: 'oklch(0.62 0.17 264)',
  },
  finance: {
    th: 'การเงินและชีวิตประจำวัน',
    en: 'Money & everyday',
    icon: 'Wallet',
    color: 'oklch(0.65 0.15 155)',
  },
  developer: {
    th: 'สำหรับนักพัฒนา',
    en: 'Developer',
    icon: 'Code',
    color: 'oklch(0.68 0.15 55)',
  },
  design: {
    th: 'ออกแบบและข้อความ',
    en: 'Design & text',
    icon: 'Palette',
    color: 'oklch(0.64 0.19 328)',
  },
};

export function isToolCategory(value: string): value is ToolCategory {
  return (CATEGORY_ORDER as readonly string[]).includes(value);
}
