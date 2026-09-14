export interface HolidayName {
  th: string;
  en: string;
}

export interface FixedHoliday {
  /** 1-12 */
  month: number;
  day: number;
  name: HolidayName;
}

export interface Holiday extends HolidayName {
  /** YYYY-MM-DD */
  date: string;
}

/**
 * Thai public holidays that fall on the same date every year, set by statute.
 *
 * Deliberately not included, because they move and are announced by the
 * government each year rather than being derivable:
 *
 *   - the Buddhist lunar holidays (Makha Bucha, Visakha Bucha, Asalha Bucha,
 *     the start of Buddhist Lent)
 *   - the Royal Ploughing Ceremony
 *   - substitution days when a holiday lands on a weekend
 *   - one-off days declared for a particular year
 *
 * Guessing those would be worse than leaving them out, so the tool says what it
 * covers and lets the reader add their own dates.
 */
export const FIXED_THAI_HOLIDAYS: readonly FixedHoliday[] = [
  { month: 1, day: 1, name: { th: 'วันขึ้นปีใหม่', en: "New Year's Day" } },
  { month: 4, day: 6, name: { th: 'วันจักรี', en: 'Chakri Memorial Day' } },
  { month: 4, day: 13, name: { th: 'วันสงกรานต์', en: 'Songkran' } },
  { month: 4, day: 14, name: { th: 'วันสงกรานต์', en: 'Songkran' } },
  { month: 4, day: 15, name: { th: 'วันสงกรานต์', en: 'Songkran' } },
  { month: 5, day: 1, name: { th: 'วันแรงงานแห่งชาติ', en: 'National Labour Day' } },
  { month: 5, day: 4, name: { th: 'วันฉัตรมงคล', en: 'Coronation Day' } },
  {
    month: 6,
    day: 3,
    name: { th: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี', en: "The Queen's Birthday" },
  },
  {
    month: 7,
    day: 28,
    name: { th: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว', en: "The King's Birthday" },
  },
  {
    month: 8,
    day: 12,
    name: { th: 'วันแม่แห่งชาติ', en: "Mother's Day" },
  },
  {
    month: 10,
    day: 13,
    name: { th: 'วันนวมินทรมหาราช', en: 'King Bhumibol Memorial Day' },
  },
  { month: 10, day: 23, name: { th: 'วันปิยมหาราช', en: 'Chulalongkorn Day' } },
  {
    month: 12,
    day: 5,
    name: { th: 'วันพ่อแห่งชาติ', en: "Father's Day and National Day" },
  },
  { month: 12, day: 10, name: { th: 'วันรัฐธรรมนูญ', en: 'Constitution Day' } },
  { month: 12, day: 31, name: { th: 'วันสิ้นปี', en: "New Year's Eve" } },
];

const PAD = 2;

function iso(year: number, month: number, day: number): string {
  return [
    String(year),
    String(month).padStart(PAD, '0'),
    String(day).padStart(PAD, '0'),
  ].join('-');
}

export function thaiHolidaysFor(year: number): Holiday[] {
  return FIXED_THAI_HOLIDAYS.map((holiday) => ({
    date: iso(year, holiday.month, holiday.day),
    ...holiday.name,
  }));
}

export function thaiHolidaySet(fromYear: number, toYear: number): Set<string> {
  const dates = new Set<string>();

  for (let year = fromYear; year <= toYear; year += 1) {
    for (const holiday of thaiHolidaysFor(year)) dates.add(holiday.date);
  }

  return dates;
}
