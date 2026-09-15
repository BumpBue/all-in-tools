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
  install: {
    action: 'ติดตั้งเป็นแอป',
    hint: 'เปิดใช้ได้จากหน้าจอหลัก และยังใช้ได้ตอนไม่มีเน็ต',
    dismiss: 'ไม่ติดตั้งตอนนี้',
    iosTitle: 'ติดตั้งบน iPhone หรือ iPad',
    iosSteps: 'กดปุ่มแบ่งปันในแถบล่างของ Safari แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"',
  },
  settings: {
    title: 'ตั้งค่า',
    appearance: 'การแสดงผล',
    data: 'ข้อมูลของคุณ',
    dataNote:
      'ข้อมูลทั้งหมดอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น ล้างข้อมูลเบราว์เซอร์แล้วจะหายไป ควรสำรองไว้เป็นระยะ',
    stored: 'เครื่องมือที่เก็บข้อมูลไว้',
    storedEmpty: 'ยังไม่มีเครื่องมือไหนเก็บข้อมูลไว้',
    storedEmptyHint: 'เมื่อเริ่มใช้เครื่องมือที่บันทึกข้อมูลได้ รายการจะขึ้นที่นี่',
    itemCount: '{count} รายการ',
    updatedAt: 'แก้ไขล่าสุด {when}',
    usage: 'ใช้พื้นที่ไปประมาณ {size}',
    deleteOne: 'ลบข้อมูลของเครื่องมือนี้',
    export: 'ดาวน์โหลดไฟล์สำรอง',
    exportEmpty: 'ยังไม่มีข้อมูลให้สำรอง',
    import: 'นำเข้าจากไฟล์',
    importDrop: 'ลากไฟล์ .json มาวางที่นี่ หรือกดเพื่อเลือกไฟล์',
    importReview: 'ตรวจสอบก่อนนำเข้า',
    importWillTouch: 'ไฟล์นี้จะเขียนข้อมูลของ {count} เครื่องมือ',
    importModeMerge: 'รวมกับของเดิม',
    importModeMergeHint: 'เขียนทับเฉพาะเครื่องมือที่มีในไฟล์ ตัวอื่นคงเดิม',
    importModeReplace: 'แทนที่ทั้งหมด',
    importModeReplaceHint: 'ลบข้อมูลของเครื่องมือที่ไม่มีในไฟล์ออกด้วย',
    importConfirm: 'นำเข้าเลย',
    importCancel: 'ยกเลิก',
    importFailed: 'นำเข้าไม่ได้',
    importDone: 'นำเข้าข้อมูลของ {count} เครื่องมือแล้ว',
    clear: 'ล้างข้อมูลทั้งหมด',
    clearWarning:
      'ลบข้อมูลของทุกเครื่องมือในเบราว์เซอร์นี้ ย้อนกลับไม่ได้ ถ้ายังไม่ได้สำรองไฟล์ไว้ ให้ดาวน์โหลดก่อน',
    clearPrompt: 'พิมพ์ {word} เพื่อยืนยัน',
    clearWord: 'ลบทั้งหมด',
    clearConfirm: 'ยืนยันการลบ',
    clearDone: 'ล้างข้อมูลเรียบร้อยแล้ว',
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
  install: {
    action: 'Install as an app',
    hint: 'Opens from your home screen and keeps working without a connection.',
    dismiss: 'Not now',
    iosTitle: 'Installing on an iPhone or iPad',
    iosSteps:
      'Tap the share button in the Safari toolbar, then choose "Add to Home Screen".',
  },
  settings: {
    title: 'Settings',
    appearance: 'Appearance',
    data: 'Your data',
    dataNote:
      'Everything lives in this browser only. Clearing browser data removes it, so take a backup now and then.',
    stored: 'Tools holding data',
    storedEmpty: 'No tool is storing anything yet',
    storedEmptyHint: 'Tools that save your work will show up here once you use them.',
    itemCount: '{count} items',
    updatedAt: 'Updated {when}',
    usage: 'Using roughly {size}',
    deleteOne: 'Delete this tool’s data',
    export: 'Download a backup',
    exportEmpty: 'Nothing to back up yet',
    import: 'Import from a file',
    importDrop: 'Drop a .json file here, or click to choose one',
    importReview: 'Review before importing',
    importWillTouch: 'This file writes data for {count} tools',
    importModeMerge: 'Merge',
    importModeMergeHint: 'Overwrite only the tools in the file and leave the rest alone',
    importModeReplace: 'Replace everything',
    importModeReplaceHint: 'Also delete data for tools that are not in the file',
    importConfirm: 'Import now',
    importCancel: 'Cancel',
    importFailed: 'Could not import',
    importDone: 'Imported data for {count} tools',
    clear: 'Delete all data',
    clearWarning:
      'Removes every tool’s data from this browser. This cannot be undone. Download a backup first if you have not.',
    clearPrompt: 'Type {word} to confirm',
    clearWord: 'DELETE',
    clearConfirm: 'Confirm deletion',
    clearDone: 'All data deleted',
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
