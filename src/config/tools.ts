import { buildToolStorageKey } from '@/config/storage-keys';
import type {
  CategoryMeta,
  Tool,
  ToolCategory,
  ToolDefinition,
} from '@/types/tool';

export type {
  CategoryMeta,
  LocalizedText,
  Tool,
  ToolCategory,
  ToolDefinition,
  ToolStatus,
  ToolTier,
} from '@/types/tool';

/** Display order for every page that lists categories. */
export const CATEGORY_ORDER: readonly ToolCategory[] = [
  'productivity',
  'finance',
  'developer',
  'design',
];

/**
 * Colours are raw CSS values, not Tailwind classes: Tailwind cannot generate a
 * class from a runtime string, so consumers set them as a custom property.
 */
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

// --- Scoring weights for searchTools, highest signal first ---
const SCORE_SLUG_EXACT = 1000;
const SCORE_NAME_EXACT = 900;
const SCORE_NAME_PREFIX = 600;
const SCORE_NAME_SUBSTRING = 400;
const SCORE_KEYWORD_PREFIX = 320;
const SCORE_KEYWORD_SUBSTRING = 220;
const SCORE_DESCRIPTION_SUBSTRING = 90;
const SCORE_FUZZY_SUBSEQUENCE = 45;
/** Ready tools outrank placeholders at equal relevance. */
const SCORE_READY_BONUS = 25;

/** Below this length a subsequence match is noise rather than a typo. */
const MIN_FUZZY_QUERY_LENGTH = 3;

const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  // --- productivity ---
  {
    id: 1,
    slug: 'pomodoro',
    name: { th: 'Focus & Pomodoro Timer', en: 'Focus & Pomodoro Timer' },
    description: {
      th: 'จับเวลาทำงานแบบโพโมโดโร สลับช่วงโฟกัสกับช่วงพัก พร้อมเก็บสถิติย้อนหลัง',
      en: 'A Pomodoro work timer that cycles focus and break intervals and keeps your session history.',
    },
    keywords: [
      'โพโมโดโร',
      'จับเวลา',
      'นาฬิกาจับเวลา',
      'โฟกัส',
      'สมาธิ',
      'ตั้งเวลาอ่านหนังสือ',
      'pomodoro',
      'timer',
      'focus',
      'productivity',
      'study timer',
    ],
    category: 'productivity',
    tier: 'C',
    icon: 'Timer',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 2,
    slug: 'eisenhower-matrix',
    name: { th: 'Eisenhower Matrix', en: 'Eisenhower Matrix' },
    description: {
      th: 'จัดลำดับงานด้วยตารางสี่ช่อง ด่วน/สำคัญ เพื่อตัดสินใจว่าต้องลงมือทำอะไรก่อน',
      en: 'Sort tasks into the urgent/important four-quadrant grid to decide what to do first.',
    },
    keywords: [
      'ไอเซนฮาวร์',
      'จัดลำดับความสำคัญ',
      'เร่งด่วน',
      'สำคัญ',
      'ตารางงาน',
      'บริหารเวลา',
      'eisenhower',
      'matrix',
      'priority',
      'urgent',
      'important',
      'todo',
    ],
    category: 'productivity',
    tier: 'C',
    icon: 'Grid2x2',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 3,
    slug: 'flashcards',
    name: { th: 'Quick Flashcards', en: 'Quick Flashcards' },
    description: {
      th: 'สร้างบัตรคำแบบพลิกอ่าน ทบทวนได้ทันทีโดยไม่ต้องสมัครสมาชิก',
      en: 'Build flip cards and start reviewing right away — no account required.',
    },
    keywords: [
      'บัตรคำ',
      'แฟลชการ์ด',
      'ท่องศัพท์',
      'ทบทวน',
      'ความจำ',
      'ท่องจำ',
      'flashcard',
      'cards',
      'memorize',
      'review',
      'vocabulary',
      'quiz',
    ],
    category: 'productivity',
    tier: 'C',
    icon: 'Layers',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 4,
    slug: 'target-grade',
    name: { th: 'คำนวณคะแนนที่ต้องได้', en: 'Target Grade Calculator' },
    description: {
      th: 'คำนวณว่าต้องทำคะแนนสอบที่เหลืออีกเท่าไรถึงจะได้เกรดตามเป้าที่ตั้งไว้',
      en: 'Work out the score you still need on remaining exams to reach your target grade.',
    },
    keywords: [
      'คะแนนที่ต้องได้',
      'เกรดเป้าหมาย',
      'คำนวณคะแนน',
      'สอบปลายภาค',
      'สอบกลางภาค',
      'ต้องได้กี่คะแนน',
      'target grade',
      'required score',
      'exam',
      'final grade',
      'calculator',
    ],
    category: 'productivity',
    tier: 'C',
    icon: 'Target',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 5,
    slug: 'habit-tracker',
    name: { th: 'Habit Tracker', en: 'Habit Tracker' },
    description: {
      th: 'ติดตามนิสัยรายวันและดูสถิติความต่อเนื่องบนปฏิทินแบบเห็นภาพรวมทั้งเดือน',
      en: 'Track daily habits and watch your streaks build across a month-at-a-glance calendar.',
    },
    keywords: [
      'นิสัย',
      'ติดตามนิสัย',
      'ทำต่อเนื่อง',
      'สตรีค',
      'วินัย',
      'เช็กลิสต์รายวัน',
      'habit',
      'tracker',
      'streak',
      'daily',
      'routine',
      'consistency',
    ],
    category: 'productivity',
    tier: 'C',
    icon: 'CalendarCheck',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 6,
    slug: 'spaced-repetition',
    name: { th: 'Spaced Repetition Planner', en: 'Spaced Repetition Planner' },
    description: {
      th: 'วางแผนวันทบทวนตามหลักการทิ้งช่วง ช่วยให้จำได้นานขึ้นโดยใช้เวลาอ่านน้อยลง',
      en: 'Schedule review dates using spaced repetition so material sticks with less study time.',
    },
    keywords: [
      'ทบทวนแบบทิ้งช่วง',
      'ตารางทบทวน',
      'ความจำระยะยาว',
      'อ่านหนังสือ',
      'แผนอ่านหนังสือ',
      'spaced repetition',
      'review schedule',
      'anki',
      'sm-2',
      'memory',
      'study plan',
    ],
    category: 'productivity',
    tier: 'C',
    icon: 'Repeat',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 7,
    slug: 'gpa-calculator',
    name: { th: 'คำนวณเกรดเฉลี่ย', en: 'GPA Calculator' },
    description: {
      th: 'คำนวณ GPA รายเทอมและ GPAX สะสม จากหน่วยกิตและเกรดของแต่ละวิชา',
      en: 'Compute per-term GPA and cumulative GPAX from course credits and grades.',
    },
    keywords: [
      'เกรดเฉลี่ย',
      'จีพีเอ',
      'คำนวณเกรด',
      'หน่วยกิต',
      'เกรดสะสม',
      'จีแพ็ก',
      'gpa',
      'gpax',
      'grade point average',
      'credits',
      'transcript',
    ],
    category: 'productivity',
    tier: 'C',
    icon: 'GraduationCap',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 8,
    slug: 'word-counter',
    name: { th: 'นับคำและเวลาอ่าน', en: 'Word & Reading Time Counter' },
    description: {
      th: 'นับจำนวนคำ ตัวอักษร ประโยค และย่อหน้า พร้อมประมาณเวลาที่ใช้อ่าน รองรับภาษาไทย',
      en: 'Count words, characters, sentences and paragraphs, and estimate reading time.',
    },
    keywords: [
      'นับคำ',
      'นับตัวอักษร',
      'เวลาอ่าน',
      'จำนวนคำ',
      'นับย่อหน้า',
      'ความยาวบทความ',
      'word count',
      'character count',
      'reading time',
      'letters',
      'paragraphs',
    ],
    category: 'productivity',
    tier: 'A',
    icon: 'FileText',
    status: 'planned',
    needsStorage: false,
  },

  // --- finance ---
  {
    id: 9,
    slug: 'bill-splitter',
    name: { th: 'หารบิลและหักหนี้', en: 'Bill Splitter & Debt Settler' },
    description: {
      th: 'หารค่าใช้จ่ายในกลุ่มแล้วสรุปว่าใครต้องโอนให้ใคร ด้วยจำนวนการโอนที่น้อยที่สุด',
      en: 'Split group expenses and settle who owes whom using the fewest transfers.',
    },
    keywords: [
      'หารบิล',
      'หารค่าอาหาร',
      'แชร์ค่าใช้จ่าย',
      'ใครจ่ายเท่าไร',
      'หนี้เพื่อน',
      'จ่ายคนละเท่าไร',
      'bill split',
      'split bill',
      'settle up',
      'group expense',
      'debt',
    ],
    category: 'finance',
    tier: 'C',
    icon: 'Receipt',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 10,
    slug: 'subscription-tracker',
    name: { th: 'ติดตามค่าสมาชิกรายเดือน', en: 'Subscription Tracker' },
    description: {
      th: 'รวมรายการสมัครสมาชิกทั้งหมดไว้ที่เดียว ดูยอดรวมต่อเดือนต่อปี และวันตัดรอบถัดไป',
      en: 'Keep every subscription in one list with monthly and yearly totals and next billing dates.',
    },
    keywords: [
      'ค่าสมาชิก',
      'รายเดือน',
      'ซับสคริปชัน',
      'ค่าบริการรายเดือน',
      'ตัดบัตร',
      'ค่าใช้จ่ายประจำ',
      'subscription',
      'recurring',
      'billing',
      'monthly cost',
      'netflix',
    ],
    category: 'finance',
    tier: 'C',
    icon: 'CreditCard',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 11,
    slug: 'decision-matrix',
    name: { th: 'ตารางตัดสินใจถ่วงน้ำหนัก', en: 'Weighted Decision Matrix' },
    description: {
      th: 'ให้คะแนนแต่ละตัวเลือกตามเกณฑ์ที่ถ่วงน้ำหนักไว้ แล้วดูว่าตัวเลือกไหนได้คะแนนรวมสูงสุด',
      en: 'Score each option against weighted criteria and see which one comes out ahead.',
    },
    keywords: [
      'ตัดสินใจ',
      'ถ่วงน้ำหนัก',
      'เปรียบเทียบตัวเลือก',
      'ให้คะแนน',
      'เลือกไม่ถูก',
      'ข้อดีข้อเสีย',
      'decision matrix',
      'weighted',
      'compare options',
      'pros and cons',
      'scoring',
    ],
    category: 'finance',
    tier: 'C',
    icon: 'Scale',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 12,
    slug: 'countdown',
    name: { th: 'นับถอยหลังวันสำคัญ', en: 'Event Countdown' },
    description: {
      th: 'นับถอยหลังถึงวันสอบ วันเดินทาง หรือเดดไลน์ เห็นเวลาที่เหลือแบบเรียลไทม์',
      en: 'Count down to exams, trips or deadlines with a live remaining-time display.',
    },
    keywords: [
      'นับถอยหลัง',
      'วันสำคัญ',
      'เดดไลน์',
      'เหลืออีกกี่วัน',
      'วันสอบ',
      'วันครบกำหนด',
      'countdown',
      'days left',
      'deadline',
      'event timer',
      'due date',
    ],
    category: 'finance',
    tier: 'C',
    icon: 'CalendarClock',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 13,
    slug: 'randomizer-wheel',
    name: { th: 'กงล้อสุ่ม', en: 'Randomizer Wheel' },
    description: {
      th: 'ใส่ตัวเลือกแล้วหมุนกงล้อให้ช่วยตัดสินใจ บันทึกชุดตัวเลือกไว้ใช้ซ้ำได้',
      en: 'Spin a wheel to pick from your options, with saved lists you can reuse.',
    },
    keywords: [
      'กงล้อ',
      'วงล้อ',
      'สุ่ม',
      'จับฉลาก',
      'เสี่ยงโชค',
      'กินอะไรดี',
      'random wheel',
      'spinner',
      'picker',
      'raffle',
      'lucky draw',
    ],
    category: 'finance',
    tier: 'B',
    icon: 'Disc3',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 14,
    slug: 'unit-converter',
    name: { th: 'แปลงหน่วย', en: 'Unit Converter' },
    description: {
      th: 'แปลงหน่วยความยาว น้ำหนัก อุณหภูมิ พื้นที่ ปริมาตร และความเร็ว รวมถึงหน่วยไทยอย่างไร่และวา',
      en: 'Convert length, weight, temperature, area, volume and speed, including Thai units.',
    },
    keywords: [
      'แปลงหน่วย',
      'เมตร',
      'กิโลกรัม',
      'องศา',
      'ไมล์',
      'นิ้ว',
      'ไร่',
      'ตารางวา',
      'unit converter',
      'metric',
      'imperial',
      'celsius',
      'fahrenheit',
      'kilometers',
    ],
    category: 'finance',
    tier: 'A',
    icon: 'Ruler',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 15,
    slug: 'date-calculator',
    name: { th: 'คำนวณวันเวลา', en: 'Date Calculator' },
    description: {
      th: 'หาจำนวนวันระหว่างสองวันที่ บวกลบวันจากวันตั้งต้น และแปลงระหว่าง พ.ศ. กับ ค.ศ.',
      en: 'Find the span between two dates, add or subtract days, and convert Buddhist and Gregorian years.',
    },
    keywords: [
      'คำนวณวัน',
      'ห่างกันกี่วัน',
      'บวกวัน',
      'นับวัน',
      'พ.ศ.',
      'ค.ศ.',
      'อายุ',
      'date calculator',
      'days between',
      'add days',
      'buddhist year',
      'age',
    ],
    category: 'finance',
    tier: 'A',
    icon: 'CalendarDays',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 16,
    slug: 'qr-generator',
    name: { th: 'สร้าง QR Code', en: 'QR Code Generator' },
    description: {
      th: 'สร้าง QR Code จากลิงก์หรือข้อความ ปรับขนาดและสีได้ แล้วดาวน์โหลดเป็นรูปทันที',
      en: 'Turn a link or text into a QR code, restyle it, and download it as an image.',
    },
    keywords: [
      'คิวอาร์โค้ด',
      'สร้างคิวอาร์',
      'สแกน',
      'พร้อมเพย์',
      'บาร์โค้ด',
      'qr code',
      'qrcode',
      'generator',
      'barcode',
      'scan',
    ],
    category: 'finance',
    tier: 'B',
    icon: 'QrCode',
    status: 'planned',
    needsStorage: false,
  },

  // --- developer ---
  {
    id: 17,
    slug: 'json-formatter',
    name: { th: 'JSON Formatter & Validator', en: 'JSON Formatter & Validator' },
    description: {
      th: 'จัดรูปแบบ JSON ให้อ่านง่าย ย่อขนาด และชี้ตำแหน่งที่ผิดไวยากรณ์อย่างแม่นยำ',
      en: 'Pretty-print, minify and validate JSON with precise error positions.',
    },
    keywords: [
      'เจสัน',
      'จัดรูปแบบเจสัน',
      'ตรวจสอบ json',
      'ย่อ json',
      'json',
      'format',
      'beautify',
      'prettify',
      'minify',
      'validate',
      'parser',
    ],
    category: 'developer',
    tier: 'A',
    icon: 'Braces',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 18,
    slug: 'mock-data-generator',
    name: { th: 'สร้างข้อมูลจำลอง', en: 'Mock Data Generator' },
    description: {
      th: 'สร้างข้อมูลตัวอย่างเป็น JSON หรือ CSV สำหรับทดสอบระบบ รองรับชื่อและที่อยู่แบบไทย',
      en: 'Generate sample JSON or CSV records for testing, with Thai names and addresses.',
    },
    keywords: [
      'ข้อมูลจำลอง',
      'ข้อมูลตัวอย่าง',
      'สุ่มข้อมูล',
      'ข้อมูลทดสอบ',
      'mock data',
      'fake data',
      'seed data',
      'faker',
      'csv',
      'json',
      'dummy',
    ],
    category: 'developer',
    tier: 'B',
    icon: 'Database',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 19,
    slug: 'base-converter',
    name: { th: 'แปลงเลขฐาน', en: 'Base Converter' },
    description: {
      th: 'แปลงเลขระหว่างฐาน 2 ถึง 36 รองรับเลขติดลบและเลขขนาดใหญ่เกินขีดจำกัดของ Number',
      en: 'Convert numbers between base 2 and 36, with negatives and arbitrarily large integers.',
    },
    keywords: [
      'เลขฐาน',
      'ฐานสอง',
      'ฐานสิบหก',
      'ฐานแปด',
      'ฐานสิบ',
      'ไบนารี',
      'เลขฐานสิบหก',
      'binary',
      'hex',
      'hexadecimal',
      'octal',
      'decimal',
      'base converter',
      'radix',
      'bit',
    ],
    category: 'developer',
    tier: 'A',
    icon: 'Binary',
    status: 'ready',
    needsStorage: false,
  },
  {
    id: 20,
    slug: 'regex-tester',
    name: { th: 'ทดสอบ Regex', en: 'Regex Tester' },
    description: {
      th: 'ทดสอบ regular expression กับข้อความจริง เห็นทุกจุดที่ตรงและกลุ่มที่จับได้',
      en: 'Test regular expressions against real text with highlighted matches and capture groups.',
    },
    keywords: [
      'เรกเอ็กซ์',
      'นิพจน์ปกติ',
      'ค้นหารูปแบบ',
      'จับคู่ข้อความ',
      'regex',
      'regexp',
      'regular expression',
      'pattern',
      'match',
      'capture group',
    ],
    category: 'developer',
    tier: 'A',
    icon: 'Regex',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 21,
    slug: 'cron-generator',
    name: { th: 'สร้าง Cron Expression', en: 'Cron Expression Generator' },
    description: {
      th: 'สร้างและอ่าน cron expression เป็นภาษาคน พร้อมแสดงเวลาที่จะรันครั้งถัดไป',
      en: 'Build and explain cron expressions in plain language, with upcoming run times.',
    },
    keywords: [
      'ครอน',
      'ตั้งเวลารัน',
      'งานตามเวลา',
      'ตารางเวลา',
      'crontab',
      'cron',
      'schedule',
      'expression',
      'next run',
      'job',
    ],
    category: 'developer',
    tier: 'B',
    icon: 'AlarmClock',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 22,
    slug: 'jwt-decoder',
    name: { th: 'ถอดรหัส JWT', en: 'JWT Decoder' },
    description: {
      th: 'แยก header payload และ signature ของ JWT ออกมาอ่าน พร้อมบอกว่าโทเคนหมดอายุหรือยัง',
      en: 'Split a JWT into header, payload and signature, and show whether it has expired.',
    },
    keywords: [
      'เจดับเบิลยูที',
      'ถอดรหัสโทเคน',
      'โทเคน',
      'หมดอายุ',
      'jwt',
      'token',
      'decode',
      'bearer',
      'claims',
      'payload',
      'auth',
    ],
    category: 'developer',
    tier: 'A',
    icon: 'KeyRound',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 23,
    slug: 'url-encoder',
    name: { th: 'URL Encoder / Decoder', en: 'URL Encoder / Decoder' },
    description: {
      th: 'เข้ารหัสและถอดรหัส URL พร้อมแยกดูพารามิเตอร์ใน query string ทีละตัว',
      en: 'Encode and decode URLs and break query strings down parameter by parameter.',
    },
    keywords: [
      'เข้ารหัส url',
      'ถอดรหัส url',
      'พารามิเตอร์',
      'คิวรีสตริง',
      'ลิงก์',
      'url encode',
      'url decode',
      'percent encoding',
      'query string',
      'uri',
      'escape',
    ],
    category: 'developer',
    tier: 'A',
    icon: 'Link',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 24,
    slug: 'hash-generator',
    name: { th: 'สร้าง Hash', en: 'Hash Generator' },
    description: {
      th: 'สร้างค่าแฮช SHA-1, SHA-256, SHA-384 และ SHA-512 จากข้อความ โดยใช้ Web Crypto ในเบราว์เซอร์',
      en: 'Produce SHA-1, SHA-256, SHA-384 and SHA-512 digests from text using the browser Web Crypto API.',
    },
    keywords: [
      'แฮช',
      'เข้ารหัสข้อความ',
      'ลายนิ้วมือข้อมูล',
      'ตรวจสอบไฟล์',
      'hash',
      'sha256',
      'sha-1',
      'sha512',
      'digest',
      'checksum',
      'crypto',
    ],
    category: 'developer',
    tier: 'A',
    icon: 'Hash',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 25,
    slug: 'markdown-preview',
    name: { th: 'Markdown Live Preview', en: 'Markdown Live Preview' },
    description: {
      th: 'พิมพ์ Markdown แล้วเห็นผลลัพธ์ทันทีข้างกัน บันทึกร่างไว้ในเครื่องให้อัตโนมัติ',
      en: 'Write Markdown beside a live rendered preview, with drafts auto-saved on your device.',
    },
    keywords: [
      'มาร์กดาวน์',
      'พรีวิว',
      'เขียนบันทึก',
      'แปลง markdown',
      'markdown',
      'preview',
      'md',
      'editor',
      'render',
      'readme',
    ],
    category: 'developer',
    tier: 'B',
    icon: 'FileCode',
    status: 'planned',
    needsStorage: true,
  },
  {
    id: 31,
    slug: 'base64',
    name: { th: 'Base64 Encoder / Decoder', en: 'Base64 Encoder / Decoder' },
    description: {
      th: 'เข้ารหัสและถอดรหัส Base64 รองรับข้อความภาษาไทยแบบ UTF-8 และไฟล์เป็น data URL',
      en: 'Encode and decode Base64 with full UTF-8 support, including files as data URLs.',
    },
    keywords: [
      'เบสหกสิบสี่',
      'เข้ารหัสข้อความ',
      'ถอดรหัสข้อความ',
      'แปลงข้อความ',
      'base64',
      'encode',
      'decode',
      'btoa',
      'atob',
      'data url',
      'utf-8',
    ],
    category: 'developer',
    tier: 'A',
    icon: 'ArrowLeftRight',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 32,
    slug: 'timestamp-converter',
    name: { th: 'แปลง Unix Timestamp', en: 'Unix Timestamp Converter' },
    description: {
      th: 'แปลง Unix timestamp เป็นวันเวลาที่อ่านได้และแปลงกลับ รองรับหน่วยวินาที มิลลิวินาที และหลายไทม์โซน',
      en: 'Convert Unix timestamps to readable dates and back, in seconds or milliseconds, across time zones.',
    },
    keywords: [
      'ไทม์สแตมป์',
      'เวลายูนิกซ์',
      'แปลงเวลา',
      'อีพอค',
      'เขตเวลา',
      'timestamp',
      'unix',
      'epoch',
      'iso 8601',
      'timezone',
      'milliseconds',
    ],
    category: 'developer',
    tier: 'A',
    icon: 'Clock',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 33,
    slug: 'text-diff',
    name: { th: 'เทียบความต่างของข้อความ', en: 'Text Diff' },
    description: {
      th: 'เทียบข้อความสองชุดทีละบรรทัดหรือทีละคำ เห็นชัดว่าส่วนไหนเพิ่มเข้ามาและส่วนไหนหายไป',
      en: 'Compare two texts line by line or word by word and see exactly what was added or removed.',
    },
    keywords: [
      'เปรียบเทียบข้อความ',
      'ความต่าง',
      'ดิฟ',
      'เทียบไฟล์',
      'เทียบเวอร์ชัน',
      'text diff',
      'compare',
      'difference',
      'changes',
      'patch',
    ],
    category: 'developer',
    tier: 'A',
    icon: 'Diff',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 34,
    slug: 'uuid-generator',
    name: { th: 'สร้าง UUID / รหัสสุ่ม', en: 'UUID & Random ID Generator' },
    description: {
      th: 'สร้าง UUID v4 และรหัสสุ่มที่ปลอดภัยทีละหลายรายการ คัดลอกไปใช้ได้ทั้งชุด',
      en: 'Generate UUID v4 values and cryptographically secure random IDs in bulk.',
    },
    keywords: [
      'ยูยูไอดี',
      'รหัสสุ่ม',
      'สุ่มไอดี',
      'คีย์สุ่ม',
      'สร้างรหัส',
      'uuid',
      'guid',
      'nanoid',
      'random id',
      'v4',
      'token',
    ],
    category: 'developer',
    tier: 'A',
    icon: 'Fingerprint',
    status: 'planned',
    needsStorage: false,
  },

  // --- design ---
  {
    id: 26,
    slug: 'css-generator',
    name: { th: 'CSS Shadow & Gradient', en: 'CSS Shadow & Gradient' },
    description: {
      th: 'ปรับเงาและไล่สีแบบเห็นผลจริงทันที แล้วคัดลอกโค้ด CSS ไปวางใช้ได้เลย',
      en: 'Dial in shadows and gradients visually, then copy the CSS straight out.',
    },
    keywords: [
      'เงา css',
      'ไล่สี',
      'เกรเดียนต์',
      'เงากล่อง',
      'สร้าง css',
      'box shadow',
      'css',
      'gradient',
      'linear gradient',
      'generator',
    ],
    category: 'design',
    tier: 'B',
    icon: 'Paintbrush',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 27,
    slug: 'aspect-ratio',
    name: { th: 'คำนวณอัตราส่วนภาพ', en: 'Aspect Ratio Calculator' },
    description: {
      th: 'หาขนาดกว้างยาวที่ยังคงอัตราส่วนเดิม เช่น 16:9 หรือ 4:3 โดยใส่ด้านเดียวแล้วได้อีกด้าน',
      en: 'Find matching width and height for a ratio such as 16:9 or 4:3 from a single dimension.',
    },
    keywords: [
      'อัตราส่วน',
      'สัดส่วนภาพ',
      'ย่อขยายภาพ',
      'ขนาดภาพ',
      'กว้างยาว',
      'aspect ratio',
      '16:9',
      'resize',
      'dimensions',
      'proportion',
    ],
    category: 'design',
    tier: 'A',
    icon: 'Proportions',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 28,
    slug: 'color-converter',
    name: { th: 'แปลงรหัสสี', en: 'Color Converter' },
    description: {
      th: 'แปลงรหัสสีระหว่าง HEX, RGB, HSL และ OKLCH พร้อมดูตัวอย่างสีจริงและคัดลอกทุกรูปแบบ',
      en: 'Convert colours between HEX, RGB, HSL and OKLCH with a live swatch and copyable values.',
    },
    keywords: [
      'รหัสสี',
      'แปลงสี',
      'สีเฮกซ์',
      'โค้ดสี',
      'เลือกสี',
      'hex',
      'rgb',
      'hsl',
      'oklch',
      'color converter',
      'color picker',
    ],
    category: 'design',
    tier: 'A',
    icon: 'Palette',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 29,
    slug: 'contrast-checker',
    name: { th: 'ตรวจ Contrast สำหรับธีมมืด', en: 'Contrast Checker' },
    description: {
      th: 'ตรวจค่าคอนทราสต์ตามมาตรฐาน WCAG ว่าตัวอักษรอ่านออกไหม ทั้งในธีมสว่างและธีมมืด',
      en: 'Check WCAG contrast ratios to confirm text stays readable in both light and dark themes.',
    },
    keywords: [
      'คอนทราสต์',
      'ความต่างของสี',
      'อ่านง่าย',
      'การเข้าถึง',
      'ธีมมืด',
      'contrast',
      'wcag',
      'accessibility',
      'a11y',
      'ratio',
      'dark mode',
    ],
    category: 'design',
    tier: 'A',
    icon: 'Contrast',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 30,
    slug: 'text-cleaner',
    name: { th: 'ล้างข้อความ', en: 'Text Cleaner' },
    description: {
      th: 'ลบช่องว่างเกิน บรรทัดว่าง และอักขระซ่อนที่ติดมาจากการคัดลอก พร้อมแปลงรูปแบบตัวพิมพ์',
      en: 'Strip stray spaces, blank lines and invisible characters from pasted text, and switch letter case.',
    },
    keywords: [
      'ล้างข้อความ',
      'ลบช่องว่าง',
      'จัดข้อความ',
      'ตัวพิมพ์ใหญ่',
      'อักขระซ่อน',
      'ลบบรรทัดว่าง',
      'text cleaner',
      'trim',
      'whitespace',
      'uppercase',
      'remove line breaks',
    ],
    category: 'design',
    tier: 'A',
    icon: 'Eraser',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 35,
    slug: 'image-resizer',
    name: { th: 'ย่อและบีบอัดรูป', en: 'Image Resizer & Compressor' },
    description: {
      th: 'ย่อขนาดและบีบอัดรูปในเครื่องของคุณเอง ไม่มีการอัปโหลดไฟล์ขึ้นเซิร์ฟเวอร์',
      en: 'Resize and compress images entirely in your browser — no file ever leaves your device.',
    },
    keywords: [
      'ย่อรูป',
      'บีบอัดรูป',
      'ลดขนาดไฟล์',
      'แปลงรูป',
      'ปรับขนาดภาพ',
      'image resize',
      'compress',
      'webp',
      'jpeg',
      'optimize',
      'shrink',
    ],
    category: 'design',
    tier: 'B',
    icon: 'ImageDown',
    status: 'planned',
    needsStorage: false,
  },
  {
    id: 36,
    slug: 'thai-lorem-ipsum',
    name: { th: 'ข้อความตัวอย่างภาษาไทย', en: 'Thai Lorem Ipsum' },
    description: {
      th: 'สร้างข้อความตัวอย่างภาษาไทยที่อ่านแล้วดูเป็นธรรมชาติ สำหรับงานออกแบบและจัดเลย์เอาต์',
      en: 'Generate natural-looking Thai placeholder text for design and layout work.',
    },
    keywords: [
      'ข้อความตัวอย่าง',
      'ลอเร็มไทย',
      'ข้อความจำลอง',
      'ข้อความหลอก',
      'ฟิลเลอร์',
      'placeholder',
      'lorem ipsum',
      'thai text',
      'dummy text',
      'filler',
    ],
    category: 'design',
    tier: 'A',
    icon: 'Languages',
    status: 'planned',
    needsStorage: false,
  },
];

/**
 * The single source of truth. Storage keys are derived from the slug here so a
 * typo in a hand-written key can never orphan a tool's saved data.
 */
export const TOOLS: readonly Tool[] = TOOL_DEFINITIONS.map((definition) =>
  definition.needsStorage
    ? { ...definition, storageKey: buildToolStorageKey(definition.slug) }
    : { ...definition },
);

export const TOOL_COUNT = TOOLS.length;

export const TOOLS_BY_SLUG: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((tool) => [tool.slug, tool]),
);

export const TOOLS_BY_CATEGORY: Record<ToolCategory, Tool[]> =
  CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = TOOLS.filter((tool) => tool.category === category);
      return acc;
    },
    {} as Record<ToolCategory, Tool[]>,
  );

export function getTool(slug: string): Tool | undefined {
  return TOOLS_BY_SLUG[slug];
}

export function isToolCategory(value: string): value is ToolCategory {
  return (CATEGORY_ORDER as readonly string[]).includes(value);
}

/**
 * Thai has no letter case and no fuzzy-friendly word boundaries, so matching is
 * done on a lowercased, whitespace-collapsed haystack of name, slug, keywords
 * and description, with a subsequence pass to absorb small typos.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

interface SearchIndexEntry {
  tool: Tool;
  names: string[];
  keywords: string[];
  descriptions: string[];
  /** Everything joined, used only by the fuzzy pass. */
  haystack: string;
}

const SEARCH_INDEX: readonly SearchIndexEntry[] = TOOLS.map((tool) => {
  const names = [tool.name.th, tool.name.en, tool.slug].map(normalize);
  const keywords = tool.keywords.map(normalize);
  const descriptions = [tool.description.th, tool.description.en].map(normalize);

  return {
    tool,
    names,
    keywords,
    descriptions,
    haystack: [...names, ...keywords].join(' '),
  };
});

/** True when every character of `query` appears in `text`, in order. */
function isSubsequence(query: string, text: string): boolean {
  let cursor = 0;
  for (const char of text) {
    if (char === query[cursor]) {
      cursor += 1;
      if (cursor === query.length) return true;
    }
  }
  return false;
}

function scoreEntry(entry: SearchIndexEntry, query: string): number {
  let score = 0;

  if (entry.tool.slug === query) {
    score += SCORE_SLUG_EXACT;
  }

  for (const name of entry.names) {
    if (name === query) score += SCORE_NAME_EXACT;
    else if (name.startsWith(query)) score += SCORE_NAME_PREFIX;
    else if (name.includes(query)) score += SCORE_NAME_SUBSTRING;
  }

  for (const keyword of entry.keywords) {
    if (keyword.startsWith(query)) score += SCORE_KEYWORD_PREFIX;
    else if (keyword.includes(query)) score += SCORE_KEYWORD_SUBSTRING;
  }

  if (score === 0) {
    for (const description of entry.descriptions) {
      if (description.includes(query)) {
        score += SCORE_DESCRIPTION_SUBSTRING;
        break;
      }
    }
  }

  if (
    score === 0 &&
    query.length >= MIN_FUZZY_QUERY_LENGTH &&
    isSubsequence(query, entry.haystack)
  ) {
    score += SCORE_FUZZY_SUBSEQUENCE;
  }

  if (score > 0 && entry.tool.status === 'ready') {
    score += SCORE_READY_BONUS;
  }

  return score;
}

/**
 * Ranked search across names, slugs, keywords and descriptions.
 * An empty query returns an empty list — callers decide what to show instead
 * (the command palette shows recently used tools).
 */
export function searchTools(query: string): Tool[] {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length === 0) return [];

  return SEARCH_INDEX.map((entry) => ({
    tool: entry.tool,
    score: scoreEntry(entry, normalizedQuery),
  }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.id - b.tool.id)
    .map((result) => result.tool);
}
