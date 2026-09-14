export const CATEGORIES = [
  'length',
  'weight',
  'temperature',
  'area',
  'volume',
  'speed',
  'data',
  'time',
  'pressure',
  'energy',
] as const;
export type CategoryId = (typeof CATEGORIES)[number];

/**
 * Where a conversion factor comes from. Anything but `exact` is a number
 * somebody decided rather than one that follows from a definition, and the
 * page says which is which.
 */
export type Provenance =
  | 'exact'
  | 'legal'
  | 'gold-bar'
  | 'gold-jewelry'
  | 'chinese'
  | 'rice'
  | 'defined'
  | 'us';

export interface UnitDefinition {
  id: string;
  symbol: string;
  th: string;
  en: string;
  /** One of this unit in base units. */
  factor: number;
  /** Only temperature needs this: value_in_base = (value - offset) * factor. */
  offset?: number;
  provenance?: Provenance;
}

export interface CategoryDefinition {
  id: CategoryId;
  th: string;
  en: string;
  /** The unit every factor in this category is expressed against. */
  base: string;
  units: readonly UnitDefinition[];
}

const INCH_METRES = 0.0254;
const POUND_GRAMS = 453.59237;

export const CATEGORY_DEFINITIONS: Readonly<Record<CategoryId, CategoryDefinition>> = {
  length: {
    id: 'length',
    th: 'ความยาว',
    en: 'Length',
    base: 'm',
    units: [
      { id: 'mm', symbol: 'mm', th: 'มิลลิเมตร', en: 'Millimetre', factor: 0.001 },
      { id: 'cm', symbol: 'cm', th: 'เซนติเมตร', en: 'Centimetre', factor: 0.01 },
      { id: 'm', symbol: 'm', th: 'เมตร', en: 'Metre', factor: 1 },
      { id: 'km', symbol: 'km', th: 'กิโลเมตร', en: 'Kilometre', factor: 1000 },
      { id: 'in', symbol: 'in', th: 'นิ้ว', en: 'Inch', factor: INCH_METRES },
      { id: 'ft', symbol: 'ft', th: 'ฟุต', en: 'Foot', factor: INCH_METRES * 12 },
      { id: 'yd', symbol: 'yd', th: 'หลา', en: 'Yard', factor: INCH_METRES * 36 },
      { id: 'mi', symbol: 'mi', th: 'ไมล์', en: 'Mile', factor: INCH_METRES * 63360 },
      {
        id: 'nmi',
        symbol: 'nmi',
        th: 'ไมล์ทะเล',
        en: 'Nautical mile',
        factor: 1852,
      },
      {
        id: 'sen',
        symbol: 'เส้น',
        th: 'เส้น',
        en: 'Sen',
        factor: 40,
        provenance: 'legal',
      },
      { id: 'wa', symbol: 'วา', th: 'วา', en: 'Wa', factor: 2, provenance: 'legal' },
      {
        id: 'sok',
        symbol: 'ศอก',
        th: 'ศอก',
        en: 'Sok (cubit)',
        factor: 0.5,
        provenance: 'legal',
      },
      {
        id: 'khuep',
        symbol: 'คืบ',
        th: 'คืบ',
        en: 'Khuep (span)',
        factor: 0.25,
        provenance: 'legal',
      },
      {
        id: 'nio',
        symbol: 'นิ้วไทย',
        th: 'นิ้วไทย',
        en: 'Thai inch',
        factor: 0.25 / 12,
        provenance: 'legal',
      },
      {
        id: 'hun-length',
        symbol: 'หุน',
        th: 'หุน (1 ใน 8 ของนิ้ว)',
        en: 'Hun (one eighth of an inch)',
        factor: INCH_METRES / 8,
        provenance: 'chinese',
      },
    ],
  },
  weight: {
    id: 'weight',
    th: 'น้ำหนัก',
    en: 'Weight',
    base: 'g',
    units: [
      { id: 'mg', symbol: 'mg', th: 'มิลลิกรัม', en: 'Milligram', factor: 0.001 },
      { id: 'g', symbol: 'g', th: 'กรัม', en: 'Gram', factor: 1 },
      { id: 'kg', symbol: 'kg', th: 'กิโลกรัม', en: 'Kilogram', factor: 1000 },
      { id: 't', symbol: 't', th: 'ตัน', en: 'Tonne', factor: 1_000_000 },
      { id: 'oz', symbol: 'oz', th: 'ออนซ์', en: 'Ounce', factor: POUND_GRAMS / 16 },
      { id: 'lb', symbol: 'lb', th: 'ปอนด์', en: 'Pound', factor: POUND_GRAMS },
      {
        id: 'baht-gold',
        symbol: 'บาท',
        th: 'บาท (ทองคำแท่ง)',
        en: 'Baht of bullion gold',
        factor: 15.244,
        provenance: 'gold-bar',
      },
      {
        id: 'baht-jewelry',
        symbol: 'บาท',
        th: 'บาท (ทองรูปพรรณ)',
        en: 'Baht of gold jewellery',
        factor: 15.16,
        provenance: 'gold-jewelry',
      },
      {
        id: 'salueng',
        symbol: 'สลึง',
        th: 'สลึง (หนึ่งในสี่บาททองคำแท่ง)',
        en: 'Salueng (quarter of a bullion baht)',
        factor: 15.244 / 4,
        provenance: 'gold-bar',
      },
      {
        id: 'tamlueng',
        symbol: 'ตำลึง',
        th: 'ตำลึง (ระบบจีน)',
        en: 'Tamlueng (Chinese tael)',
        factor: 37.5,
        provenance: 'chinese',
      },
      {
        id: 'hun-weight',
        symbol: 'หุน',
        th: 'หุน (ระบบจีน)',
        en: 'Hun (Chinese candareen)',
        factor: 0.375,
        provenance: 'chinese',
      },
    ],
  },
  temperature: {
    id: 'temperature',
    th: 'อุณหภูมิ',
    en: 'Temperature',
    base: '°C',
    units: [
      { id: 'c', symbol: '°C', th: 'เซลเซียส', en: 'Celsius', factor: 1, offset: 0 },
      {
        id: 'f',
        symbol: '°F',
        th: 'ฟาเรนไฮต์',
        en: 'Fahrenheit',
        factor: 5 / 9,
        offset: 32,
      },
      {
        id: 'k',
        symbol: 'K',
        th: 'เคลวิน',
        en: 'Kelvin',
        factor: 1,
        offset: 273.15,
      },
    ],
  },
  area: {
    id: 'area',
    th: 'พื้นที่',
    en: 'Area',
    base: 'm²',
    units: [
      { id: 'cm2', symbol: 'cm²', th: 'ตารางเซนติเมตร', en: 'Square centimetre', factor: 0.0001 },
      { id: 'm2', symbol: 'm²', th: 'ตารางเมตร', en: 'Square metre', factor: 1 },
      { id: 'km2', symbol: 'km²', th: 'ตารางกิโลเมตร', en: 'Square kilometre', factor: 1_000_000 },
      { id: 'ha', symbol: 'ha', th: 'เฮกตาร์', en: 'Hectare', factor: 10_000 },
      {
        id: 'ft2',
        symbol: 'ft²',
        th: 'ตารางฟุต',
        en: 'Square foot',
        factor: (INCH_METRES * 12) ** 2,
      },
      { id: 'acre', symbol: 'acre', th: 'เอเคอร์', en: 'Acre', factor: 4046.8564224 },
      {
        id: 'rai',
        symbol: 'ไร่',
        th: 'ไร่',
        en: 'Rai',
        factor: 1600,
        provenance: 'legal',
      },
      {
        id: 'ngan',
        symbol: 'งาน',
        th: 'งาน',
        en: 'Ngan',
        factor: 400,
        provenance: 'legal',
      },
      {
        id: 'square-wa',
        symbol: 'ตร.ว.',
        th: 'ตารางวา',
        en: 'Square wa',
        factor: 4,
        provenance: 'legal',
      },
    ],
  },
  volume: {
    id: 'volume',
    th: 'ปริมาตร',
    en: 'Volume',
    base: 'L',
    units: [
      { id: 'ml', symbol: 'ml', th: 'มิลลิลิตร', en: 'Millilitre', factor: 0.001 },
      { id: 'l', symbol: 'L', th: 'ลิตร', en: 'Litre', factor: 1 },
      { id: 'm3', symbol: 'm³', th: 'ลูกบาศก์เมตร', en: 'Cubic metre', factor: 1000 },
      {
        id: 'tsp',
        symbol: 'tsp',
        th: 'ช้อนชา (สหรัฐ)',
        en: 'Teaspoon (US)',
        factor: 0.00492892159375,
        provenance: 'us',
      },
      {
        id: 'tbsp',
        symbol: 'tbsp',
        th: 'ช้อนโต๊ะ (สหรัฐ)',
        en: 'Tablespoon (US)',
        factor: 0.01478676478125,
        provenance: 'us',
      },
      {
        id: 'cup',
        symbol: 'cup',
        th: 'ถ้วยตวง (สหรัฐ)',
        en: 'Cup (US)',
        factor: 0.2365882365,
        provenance: 'us',
      },
      {
        id: 'floz',
        symbol: 'fl oz',
        th: 'ของเหลวออนซ์ (สหรัฐ)',
        en: 'Fluid ounce (US)',
        factor: 0.0295735295625,
        provenance: 'us',
      },
      {
        id: 'gal',
        symbol: 'gal',
        th: 'แกลลอน (สหรัฐ)',
        en: 'Gallon (US)',
        factor: 3.785411784,
        provenance: 'us',
      },
      {
        id: 'thang',
        symbol: 'ถัง',
        th: 'ถัง (ตวงข้าว)',
        en: 'Thang (rice measure)',
        factor: 20,
        provenance: 'rice',
      },
      {
        id: 'kwian',
        symbol: 'เกวียน',
        th: 'เกวียน (ตวงข้าว)',
        en: 'Kwian (rice measure)',
        factor: 2000,
        provenance: 'rice',
      },
    ],
  },
  speed: {
    id: 'speed',
    th: 'ความเร็ว',
    en: 'Speed',
    base: 'm/s',
    units: [
      { id: 'mps', symbol: 'm/s', th: 'เมตรต่อวินาที', en: 'Metre per second', factor: 1 },
      {
        id: 'kmh',
        symbol: 'km/h',
        th: 'กิโลเมตรต่อชั่วโมง',
        en: 'Kilometre per hour',
        factor: 1 / 3.6,
      },
      {
        id: 'mph',
        symbol: 'mph',
        th: 'ไมล์ต่อชั่วโมง',
        en: 'Mile per hour',
        factor: (INCH_METRES * 63360) / 3600,
      },
      {
        id: 'fps',
        symbol: 'ft/s',
        th: 'ฟุตต่อวินาที',
        en: 'Foot per second',
        factor: INCH_METRES * 12,
      },
      { id: 'knot', symbol: 'kn', th: 'นอต', en: 'Knot', factor: 1852 / 3600 },
    ],
  },
  data: {
    id: 'data',
    th: 'ข้อมูลดิจิทัล',
    en: 'Digital storage',
    base: 'B',
    units: [
      { id: 'bit', symbol: 'bit', th: 'บิต', en: 'Bit', factor: 1 / 8 },
      { id: 'byte', symbol: 'B', th: 'ไบต์', en: 'Byte', factor: 1 },
      { id: 'kb', symbol: 'kB', th: 'กิโลไบต์ (ฐาน 1000)', en: 'Kilobyte (base 1000)', factor: 1e3 },
      { id: 'mb', symbol: 'MB', th: 'เมกะไบต์ (ฐาน 1000)', en: 'Megabyte (base 1000)', factor: 1e6 },
      { id: 'gb', symbol: 'GB', th: 'กิกะไบต์ (ฐาน 1000)', en: 'Gigabyte (base 1000)', factor: 1e9 },
      { id: 'tb', symbol: 'TB', th: 'เทระไบต์ (ฐาน 1000)', en: 'Terabyte (base 1000)', factor: 1e12 },
      { id: 'kib', symbol: 'KiB', th: 'กิบิไบต์ (ฐาน 1024)', en: 'Kibibyte (base 1024)', factor: 1024 },
      { id: 'mib', symbol: 'MiB', th: 'เมบิไบต์ (ฐาน 1024)', en: 'Mebibyte (base 1024)', factor: 1024 ** 2 },
      { id: 'gib', symbol: 'GiB', th: 'จิบิไบต์ (ฐาน 1024)', en: 'Gibibyte (base 1024)', factor: 1024 ** 3 },
      { id: 'tib', symbol: 'TiB', th: 'เทบิไบต์ (ฐาน 1024)', en: 'Tebibyte (base 1024)', factor: 1024 ** 4 },
    ],
  },
  time: {
    id: 'time',
    th: 'เวลา',
    en: 'Time',
    base: 's',
    units: [
      { id: 'ms', symbol: 'ms', th: 'มิลลิวินาที', en: 'Millisecond', factor: 0.001 },
      { id: 's', symbol: 's', th: 'วินาที', en: 'Second', factor: 1 },
      { id: 'min', symbol: 'min', th: 'นาที', en: 'Minute', factor: 60 },
      { id: 'h', symbol: 'h', th: 'ชั่วโมง', en: 'Hour', factor: 3600 },
      { id: 'day', symbol: 'd', th: 'วัน', en: 'Day', factor: 86_400 },
      { id: 'week', symbol: 'wk', th: 'สัปดาห์', en: 'Week', factor: 604_800 },
      {
        id: 'month',
        symbol: 'mo',
        th: 'เดือน (นับ 30 วัน)',
        en: 'Month (taken as 30 days)',
        factor: 2_592_000,
        provenance: 'defined',
      },
      {
        id: 'year',
        symbol: 'yr',
        th: 'ปี (นับ 365 วัน)',
        en: 'Year (taken as 365 days)',
        factor: 31_536_000,
        provenance: 'defined',
      },
    ],
  },
  pressure: {
    id: 'pressure',
    th: 'ความดัน',
    en: 'Pressure',
    base: 'Pa',
    units: [
      { id: 'pa', symbol: 'Pa', th: 'ปาสกาล', en: 'Pascal', factor: 1 },
      { id: 'kpa', symbol: 'kPa', th: 'กิโลปาสกาล', en: 'Kilopascal', factor: 1000 },
      { id: 'bar', symbol: 'bar', th: 'บาร์', en: 'Bar', factor: 100_000 },
      { id: 'atm', symbol: 'atm', th: 'บรรยากาศ', en: 'Atmosphere', factor: 101_325 },
      { id: 'mmhg', symbol: 'mmHg', th: 'มิลลิเมตรปรอท', en: 'Millimetre of mercury', factor: 133.322387415 },
      { id: 'psi', symbol: 'psi', th: 'ปอนด์ต่อตารางนิ้ว', en: 'Pound per square inch', factor: 6894.757293168 },
    ],
  },
  energy: {
    id: 'energy',
    th: 'พลังงาน',
    en: 'Energy',
    base: 'J',
    units: [
      { id: 'j', symbol: 'J', th: 'จูล', en: 'Joule', factor: 1 },
      { id: 'kj', symbol: 'kJ', th: 'กิโลจูล', en: 'Kilojoule', factor: 1000 },
      { id: 'cal', symbol: 'cal', th: 'แคลอรี', en: 'Calorie', factor: 4.184 },
      {
        id: 'kcal',
        symbol: 'kcal',
        th: 'กิโลแคลอรี (แคลอรีบนฉลากอาหาร)',
        en: 'Kilocalorie (the calorie on food labels)',
        factor: 4184,
      },
      { id: 'wh', symbol: 'Wh', th: 'วัตต์ชั่วโมง', en: 'Watt hour', factor: 3600 },
      { id: 'kwh', symbol: 'kWh', th: 'กิโลวัตต์ชั่วโมง (หน่วยไฟ)', en: 'Kilowatt hour', factor: 3_600_000 },
      { id: 'btu', symbol: 'BTU', th: 'บีทียู', en: 'BTU', factor: 1055.05585262 },
    ],
  },
};
