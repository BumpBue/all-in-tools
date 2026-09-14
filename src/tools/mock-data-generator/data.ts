export const THAI_FIRST_NAMES = [
  'สมชาย', 'สมหญิง', 'ปรีชา', 'วิไล', 'ณัฐพล', 'ศิริพร', 'อนุชา', 'กมลวรรณ',
  'ธนกร', 'พิมพ์ชนก', 'ชัยวัฒน์', 'สุดารัตน์', 'ภาณุพงศ์', 'อรสา', 'วีรยุทธ',
  'จิราภรณ์', 'ทศพล', 'นันทิดา', 'ปิยะ', 'เบญจมาศ', 'กฤษณะ', 'มณีรัตน์',
] as const;

export const THAI_LAST_NAMES = [
  'ใจดี', 'รักเรียน', 'ศรีสุข', 'แสงทอง', 'บุญมี', 'พัฒนการ', 'วงศ์สกุล',
  'ทองคำ', 'สุขสันต์', 'มั่งมี', 'เจริญพร', 'อุดมทรัพย์', 'ไพบูลย์',
  'ประเสริฐ', 'ชื่นบาน', 'ธรรมรักษ์', 'พงษ์พันธ์', 'สายทอง',
] as const;

export const ENGLISH_FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph',
  'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
] as const;

export const ENGLISH_LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Taylor',
  'Moore', 'Jackson', 'Martin', 'Lee', 'Clark',
] as const;

export const EMAIL_DOMAINS = [
  'example.com',
  'example.co.th',
  'mail.example.com',
  'test.example.org',
] as const;

/** The prefixes Thai mobile numbers actually start with. */
export const MOBILE_PREFIXES = ['06', '08', '09'] as const;

export interface ThaiLocation {
  province: string;
  district: string;
  subdistrict: string;
  postcode: string;
}

/**
 * A sample of real places, not the national address database, which runs to
 * thousands of rows and has no business in a page bundle. Every row here is a
 * real province, district, subdistrict and postcode that go together, so an
 * address column and a postcode column in the same row always agree. The page
 * says this is a sample.
 */
export const THAI_LOCATIONS: readonly ThaiLocation[] = [
  {
    province: 'กรุงเทพมหานคร',
    district: 'เขตบางรัก',
    subdistrict: 'แขวงสีลม',
    postcode: '10500',
  },
  {
    province: 'กรุงเทพมหานคร',
    district: 'เขตจตุจักร',
    subdistrict: 'แขวงลาดยาว',
    postcode: '10900',
  },
  {
    province: 'กรุงเทพมหานคร',
    district: 'เขตพญาไท',
    subdistrict: 'แขวงสามเสนใน',
    postcode: '10400',
  },
  {
    province: 'กรุงเทพมหานคร',
    district: 'เขตคลองเตย',
    subdistrict: 'แขวงคลองตัน',
    postcode: '10110',
  },
  {
    province: 'นนทบุรี',
    district: 'อำเภอเมืองนนทบุรี',
    subdistrict: 'ตำบลบางกระสอ',
    postcode: '11000',
  },
  {
    province: 'ปทุมธานี',
    district: 'อำเภอคลองหลวง',
    subdistrict: 'ตำบลคลองหนึ่ง',
    postcode: '12120',
  },
  {
    province: 'เชียงใหม่',
    district: 'อำเภอเมืองเชียงใหม่',
    subdistrict: 'ตำบลศรีภูมิ',
    postcode: '50200',
  },
  {
    province: 'เชียงใหม่',
    district: 'อำเภอสันทราย',
    subdistrict: 'ตำบลหนองหาร',
    postcode: '50290',
  },
  {
    province: 'ขอนแก่น',
    district: 'อำเภอเมืองขอนแก่น',
    subdistrict: 'ตำบลในเมือง',
    postcode: '40000',
  },
  {
    province: 'นครราชสีมา',
    district: 'อำเภอเมืองนครราชสีมา',
    subdistrict: 'ตำบลในเมือง',
    postcode: '30000',
  },
  {
    province: 'อุบลราชธานี',
    district: 'อำเภอเมืองอุบลราชธานี',
    subdistrict: 'ตำบลในเมือง',
    postcode: '34000',
  },
  {
    province: 'ชลบุรี',
    district: 'อำเภอบางละมุง',
    subdistrict: 'ตำบลหนองปรือ',
    postcode: '20150',
  },
  {
    province: 'ภูเก็ต',
    district: 'อำเภอเมืองภูเก็ต',
    subdistrict: 'ตำบลตลาดใหญ่',
    postcode: '83000',
  },
  {
    province: 'สงขลา',
    district: 'อำเภอหาดใหญ่',
    subdistrict: 'ตำบลหาดใหญ่',
    postcode: '90110',
  },
  {
    province: 'สุราษฎร์ธานี',
    district: 'อำเภอเกาะสมุย',
    subdistrict: 'ตำบลอ่างทอง',
    postcode: '84140',
  },
];

export const STREET_WORDS = [
  'ถนนสุขุมวิท', 'ถนนพหลโยธิน', 'ถนนรัชดาภิเษก', 'ถนนเพชรบุรี',
  'ถนนลาดพร้าว', 'ถนนงามวงศ์วาน', 'ถนนศรีนครินทร์',
] as const;

export const TEXT_WORDS = [
  'ทดสอบ', 'ตัวอย่าง', 'ข้อมูล', 'รายการ', 'สินค้า', 'บริการ', 'ระบบ',
  'รายงาน', 'เอกสาร', 'หมายเหตุ', 'รายละเอียด', 'สรุป',
] as const;
