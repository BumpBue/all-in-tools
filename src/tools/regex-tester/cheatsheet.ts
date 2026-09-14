import type { Locale } from '@/types/tool';

export interface CheatsheetEntry {
  token: string;
  th: string;
  en: string;
}

export interface CheatsheetGroup {
  th: string;
  en: string;
  entries: readonly CheatsheetEntry[];
}

export const CHEATSHEET: readonly CheatsheetGroup[] = [
  {
    th: 'อักขระ',
    en: 'Characters',
    entries: [
      { token: '.', th: 'อักขระอะไรก็ได้หนึ่งตัว (ยกเว้นขึ้นบรรทัดใหม่)', en: 'Any character except a newline' },
      { token: '\\d', th: 'ตัวเลข 0-9', en: 'A digit, 0-9' },
      {
        token: '\\w',
        th: 'ตัวอักษรอังกฤษ ตัวเลข หรือ _',
        en: 'A letter, digit or underscore',
      },
      {
        token: '\\s',
        th: 'ช่องว่าง แท็บ หรือขึ้นบรรทัดใหม่',
        en: 'A space, tab or newline',
      },
      { token: '[ก-ฮ]', th: 'ตัวใดตัวหนึ่งในช่วงที่กำหนด', en: 'Any one character in the range' },
      { token: '[^abc]', th: 'ตัวที่ไม่ใช่ a, b หรือ c', en: 'Any character except a, b or c' },
    ],
  },
  {
    th: 'จำนวนครั้ง',
    en: 'How many',
    entries: [
      { token: '*', th: 'ศูนย์ครั้งขึ้นไป', en: 'Zero or more' },
      { token: '+', th: 'หนึ่งครั้งขึ้นไป', en: 'One or more' },
      { token: '?', th: 'มีหรือไม่มีก็ได้', en: 'Optional' },
      { token: '{2,5}', th: 'ระหว่าง 2 ถึง 5 ครั้ง', en: 'Between 2 and 5 times' },
      { token: '+?', th: 'เอาน้อยที่สุดเท่าที่ยังตรง', en: 'As few as possible, not as many' },
    ],
  },
  {
    th: 'ตำแหน่ง',
    en: 'Position',
    entries: [
      { token: '^', th: 'ต้นข้อความ (ต้นบรรทัดถ้าใส่ flag m)', en: 'Start of the text, or of a line with the m flag' },
      { token: '$', th: 'ท้ายข้อความ (ท้ายบรรทัดถ้าใส่ flag m)', en: 'End of the text, or of a line with the m flag' },
      { token: '\\b', th: 'ขอบของคำ', en: 'A word boundary' },
    ],
  },
  {
    th: 'กลุ่ม',
    en: 'Groups',
    entries: [
      { token: '(abc)', th: 'จับกลุ่มไว้ใช้ต่อ อ้างถึงด้วย $1', en: 'Capture, referred to as $1' },
      { token: '(?<ชื่อ>abc)', th: 'จับกลุ่มพร้อมตั้งชื่อ อ้างถึงด้วย $<ชื่อ>', en: 'Named capture, referred to as $<name>' },
      { token: '(?:abc)', th: 'จัดกลุ่มเฉยๆ ไม่จับไว้', en: 'Group without capturing' },
      { token: 'a|b', th: 'a หรือ b', en: 'Either a or b' },
      { token: '(?=abc)', th: 'ตามด้วย abc แต่ไม่นับรวม', en: 'Followed by abc, without consuming it' },
      { token: '(?!abc)', th: 'ต้องไม่ตามด้วย abc', en: 'Not followed by abc' },
    ],
  },
];

export function cheatsheetLabel(group: CheatsheetGroup, locale: Locale): string {
  return locale === 'th' ? group.th : group.en;
}

export function entryLabel(entry: CheatsheetEntry, locale: Locale): string {
  return locale === 'th' ? entry.th : entry.en;
}
