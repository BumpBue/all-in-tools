import type { Locale, LocalizedText } from '@/types/tool';

const TH = {
  skipToContent: 'ข้ามไปยังเนื้อหาหลัก',
  brand: {
    tagline: 'เครื่องมือออนไลน์ 36 ตัวในที่เดียว',
    home: 'กลับหน้าแรก',
  },
  nav: {
    home: 'หน้าแรก',
    settings: 'ตั้งค่า',
    categories: 'หมวดหมู่',
    menu: 'เมนู',
  },
  search: {
    trigger: 'ค้นหาเครื่องมือ',
    placeholder: 'พิมพ์ชื่อเครื่องมือที่ต้องการ',
    empty: 'ไม่พบเครื่องมือที่ตรงกับคำค้น',
    emptyHint: 'ลองพิมพ์คำอื่น เช่น ชื่อภาษาอังกฤษหรือสิ่งที่อยากทำ',
    results: 'พบ {count} เครื่องมือ',
    close: 'ปิดการค้นหา',
    hintNavigate: 'เลื่อน',
    hintSelect: 'เปิด',
    hintClose: 'ปิด',
    pageTitle: 'ค้นหาเครื่องมือ',
    resultsFor: 'ผลการค้นหา "{query}"',
    submit: 'ค้นหา',
    backHome: 'กลับหน้าแรก',
  },
  theme: {
    label: 'ธีม',
    light: 'สว่าง',
    dark: 'มืด',
    system: 'ตามระบบ',
  },
  language: {
    label: 'ภาษา',
    th: 'ไทย',
    en: 'อังกฤษ',
  },
  home: {
    recent: 'ใช้ล่าสุด',
    favorites: 'รายการโปรด',
    allTools: 'เครื่องมือทั้งหมด',
    heroTitle: 'เครื่องมือที่ต้องใช้บ่อย รวมไว้ที่เดียว',
    heroSubtitle:
      'คำนวณ แปลง จัดการงาน และช่วยงานเขียนโค้ด {count} เครื่องมือ เปิดใช้ได้ทันทีโดยไม่ต้องสมัครสมาชิก',
    toolCount: '{count} เครื่องมือ',
    privacyNote:
      'ทุกอย่างประมวลผลในเบราว์เซอร์ของคุณ ไม่มีการส่งข้อมูลออกไปที่เซิร์ฟเวอร์',
  },
  tool: {
    comingSoon: 'เร็วๆ นี้',
    addFavorite: 'เพิ่มในรายการโปรด',
    removeFavorite: 'เอาออกจากรายการโปรด',
    share: 'คัดลอกลิงก์',
    related: 'เครื่องมือที่เกี่ยวข้อง',
    notReady: 'เครื่องมือนี้กำลังพัฒนาอยู่ อีกไม่นานจะได้ใช้งาน',
    backToCategory: 'ดูเครื่องมืออื่นในหมวดนี้',
    linkCopied: 'คัดลอกลิงก์แล้ว',
  },
  footer: {
    privacy:
      'ทุกเครื่องมือทำงานในเบราว์เซอร์ของคุณ ข้อมูลที่คุณกรอกไม่ถูกส่งออกไปที่ใดทั้งสิ้น',
    rights: 'ใช้งานได้ฟรี ไม่ต้องสมัครสมาชิก',
  },
  baseConverter: {
    base2: 'ฐานสอง (Binary)',
    base8: 'ฐานแปด (Octal)',
    base10: 'ฐานสิบ (Decimal)',
    base16: 'ฐานสิบหก (Hexadecimal)',
    customBase: 'ฐานอื่น',
    customBaseLabel: 'เลือกฐาน',
    baseOption: 'ฐาน {base}',
    bits: 'การแทนค่าเป็นบิต',
    bitsUsed: 'ใช้ {count} บิต',
    zeroValue: 'ค่าเป็นศูนย์',
    widthFits: 'พอดีกับ',
    signed: 'มีเครื่องหมาย',
    unsigned: 'ไม่มีเครื่องหมาย',
    overflowAll: 'เกินทุกขนาดมาตรฐาน ต้องใช้ชนิดข้อมูลที่ใหญ่กว่า 64 บิต',
    clear: 'ล้างทั้งหมด',
    examples: 'ลองค่าตัวอย่าง',
    hint: 'พิมพ์ช่องไหนก็ได้ อีกสามช่องจะอัปเดตทันที ใส่ _ หรือเว้นวรรคคั่นได้',
    errorEmpty: 'ยังไม่ได้ใส่ค่า',
    errorSignOnly: 'ใส่เครื่องหมายแล้วแต่ยังไม่มีตัวเลข',
    errorInvalidBase: 'ฐานต้องอยู่ระหว่าง 2 ถึง 36',
    errorInvalidDigit: 'ใช้ "{character}" ในฐาน {base} ไม่ได้',
  },
};

type Dictionary = typeof TH;

const EN: Dictionary = {
  skipToContent: 'Skip to main content',
  brand: {
    tagline: '36 web utilities in one place',
    home: 'Back to home',
  },
  nav: {
    home: 'Home',
    settings: 'Settings',
    categories: 'Categories',
    menu: 'Menu',
  },
  search: {
    trigger: 'Search tools',
    placeholder: 'Type the name of a tool',
    empty: 'No tool matches that search',
    emptyHint: 'Try another word, such as an English name or what you want to do',
    results: 'Found {count} tools',
    close: 'Close search',
    hintNavigate: 'Navigate',
    hintSelect: 'Open',
    hintClose: 'Close',
    pageTitle: 'Search tools',
    resultsFor: 'Results for "{query}"',
    submit: 'Search',
    backHome: 'Back to home',
  },
  theme: {
    label: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },
  language: {
    label: 'Language',
    th: 'Thai',
    en: 'English',
  },
  home: {
    recent: 'Recently used',
    favorites: 'Favourites',
    allTools: 'All tools',
    heroTitle: 'The tools you keep reaching for, in one place',
    heroSubtitle:
      'Calculate, convert, organise and debug across {count} tools. Open one and start — no account needed.',
    toolCount: '{count} tools',
    privacyNote:
      'Everything runs in your browser. No data is ever sent to a server.',
  },
  tool: {
    comingSoon: 'Coming soon',
    addFavorite: 'Add to favourites',
    removeFavorite: 'Remove from favourites',
    share: 'Copy link',
    related: 'Related tools',
    notReady: 'This tool is still being built and will be available soon.',
    backToCategory: 'See other tools in this category',
    linkCopied: 'Link copied',
  },
  footer: {
    privacy:
      'Every tool runs in your browser. Nothing you type is sent anywhere.',
    rights: 'Free to use, no account needed',
  },
  baseConverter: {
    base2: 'Binary (base 2)',
    base8: 'Octal (base 8)',
    base10: 'Decimal (base 10)',
    base16: 'Hexadecimal (base 16)',
    customBase: 'Another base',
    customBaseLabel: 'Choose a base',
    baseOption: 'Base {base}',
    bits: 'Bit representation',
    bitsUsed: 'Uses {count} bits',
    zeroValue: 'The value is zero',
    widthFits: 'Fits in',
    signed: 'signed',
    unsigned: 'unsigned',
    overflowAll: 'Larger than every common width; needs more than 64 bits.',
    clear: 'Clear all',
    examples: 'Try an example',
    hint: 'Type in any field and the other three follow. Underscores and spaces are allowed.',
    errorEmpty: 'No value yet',
    errorSignOnly: 'There is a sign but no digits',
    errorInvalidBase: 'The base must be between 2 and 36',
    errorInvalidDigit: '"{character}" is not a digit in base {base}',
  },
};

export const MESSAGES: Record<Locale, Dictionary> = { th: TH, en: EN };

export function getMessages(locale: Locale): Dictionary {
  return MESSAGES[locale];
}

export function pick(text: LocalizedText, locale: Locale): string {
  return text[locale];
}

export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type { Dictionary };
