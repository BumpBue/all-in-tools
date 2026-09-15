# Toolbox

รวมเครื่องมือออนไลน์ 36 ตัวไว้ในที่เดียว ทุกตัวทำงานในเบราว์เซอร์ของคุณล้วน ๆ

Thirty-six small utilities on one site — study, money, code and design. Every one of
them runs entirely in the browser.

## What makes it different

**Nothing leaves your device.** There is no backend, no database, no account, and no
analytics. Whatever you paste into a tool is processed by JavaScript on your own
machine and never travels anywhere. A JWT you decode, an image you resize, a bill you
split — none of it is uploaded, because there is nowhere to upload it to.

Anything worth keeping is saved in `localStorage` on that one device. Tools that share
a link put the data *inside the link* rather than on a server, so a shared decision
matrix or bill is carried by the URL itself.

**It works offline.** A service worker caches the build, so pages you have opened keep
working with no connection, and the site can be installed to a home screen.

**Both languages, properly.** Thai and English throughout, with Thai word segmentation
via `Intl.Segmenter`, Buddhist-era years, Thai holidays in the date calculator, and
Thai units (ไร่, งาน, วา) in the converter.

## The tools

### Productivity · เพิ่มประสิทธิภาพ

| Tool | ทำอะไร |
| --- | --- |
| Focus & Pomodoro Timer | จับเวลาทำงานแบบโพโมโดโร สลับช่วงโฟกัสกับช่วงพัก พร้อมเก็บสถิติย้อนหลัง |
| Eisenhower Matrix | จัดลำดับงานด้วยตารางสี่ช่อง ด่วน/สำคัญ เพื่อตัดสินใจว่าต้องลงมือทำอะไรก่อน |
| Quick Flashcards | สร้างบัตรคำแบบพลิกอ่าน ทบทวนได้ทันทีโดยไม่ต้องสมัครสมาชิก |
| Target Grade Calculator | คำนวณว่าต้องทำคะแนนสอบที่เหลืออีกเท่าไรถึงจะได้เกรดตามเป้าที่ตั้งไว้ |
| Habit Tracker | ติดตามนิสัยรายวันและดูสถิติความต่อเนื่องบนปฏิทินแบบเห็นภาพรวมทั้งเดือน |
| Spaced Repetition Planner | วางแผนวันทบทวนตามหลักการทิ้งช่วง ช่วยให้จำได้นานขึ้นโดยใช้เวลาอ่านน้อยลง |
| GPA Calculator | คำนวณ GPA รายเทอมและ GPAX สะสม จากหน่วยกิตและเกรดของแต่ละวิชา |
| Word & Reading Time Counter | นับคำ ตัวอักษร ประโยค และย่อหน้า ตัดคำไทยจริงด้วย `Intl.Segmenter` |
| Event Countdown | นับถอยหลังถึงวันสอบ วันเดินทาง หรือเดดไลน์ เห็นเวลาที่เหลือแบบเรียลไทม์ |

### Money & everyday · การเงินและชีวิตประจำวัน

| Tool | ทำอะไร |
| --- | --- |
| Bill Splitter & Debt Settler | หารค่าใช้จ่ายในกลุ่มแล้วสรุปว่าใครต้องโอนให้ใคร ด้วยจำนวนการโอนที่น้อยที่สุด |
| Subscription Tracker | รวมรายการสมัครสมาชิกไว้ที่เดียว ดูยอดรวมต่อเดือนต่อปี และวันตัดรอบถัดไป |
| Weighted Decision Matrix | ให้คะแนนแต่ละตัวเลือกตามเกณฑ์ที่ถ่วงน้ำหนัก แล้วดูว่าตัวไหนได้คะแนนรวมสูงสุด |
| Randomizer Wheel | ใส่ตัวเลือกแล้วหมุนกงล้อให้ช่วยตัดสินใจ บันทึกชุดตัวเลือกไว้ใช้ซ้ำได้ |
| Unit Converter | แปลงหน่วยความยาว น้ำหนัก อุณหภูมิ พื้นที่ ปริมาตร ความเร็ว รวมถึงไร่และวา |
| Date Calculator | หาจำนวนวันระหว่างสองวันที่ นับวันทำการโดยหักวันหยุดราชการไทย พร้อมแสดง พ.ศ. |
| QR Code Generator | สร้าง QR Code จากลิงก์หรือข้อความ ปรับขนาดและสีได้ รองรับ PromptPay |

### Developer · สำหรับนักพัฒนา

| Tool | ทำอะไร |
| --- | --- |
| JSON Formatter & Validator | จัดรูปแบบ ย่อขนาด เรียงคีย์ ดูเป็นต้นไม้ แปลงเป็น TypeScript interface |
| Mock Data Generator | สร้างข้อมูลตัวอย่างเป็น JSON หรือ CSV รองรับชื่อและที่อยู่แบบไทย |
| Base Converter | แปลงเลขระหว่างฐาน 2 ถึง 36 รองรับเลขติดลบและเลขที่ใหญ่เกิน `Number` |
| Regex Tester | ทดสอบ regular expression กับข้อความจริง เห็นทุกจุดที่ตรงและกลุ่มที่จับได้ |
| Cron Expression Generator | สร้างและอ่าน cron expression เป็นภาษาคน พร้อมเวลาที่จะรันครั้งถัดไป |
| JWT Decoder | แยก header payload และ signature ออกมาอ่าน พร้อมตรวจลายเซ็นและวันหมดอายุ |
| URL Encoder / Decoder | เข้ารหัสและถอดรหัส URL พร้อมแยกดูพารามิเตอร์ใน query string ทีละตัว |
| Hash Generator | สร้างค่าแฮช MD5, SHA-1, SHA-256, SHA-384, SHA-512 จากข้อความหรือไฟล์ |
| Markdown Live Preview | พิมพ์ Markdown แล้วเห็นผลลัพธ์ทันทีข้างกัน บันทึกร่างไว้ในเครื่องอัตโนมัติ |
| Base64 Encoder / Decoder | เข้ารหัสและถอดรหัส Base64 รองรับภาษาไทยแบบ UTF-8 และไฟล์เป็น data URL |
| Unix Timestamp Converter | แปลง Unix timestamp เป็นวันเวลาที่อ่านได้และแปลงกลับ รองรับหลายไทม์โซน |
| Text Diff | เทียบข้อความสองชุดทีละบรรทัดหรือทีละคำ เห็นชัดว่าอะไรเพิ่มและอะไรหายไป |
| UUID & Random ID Generator | สร้าง UUID v4, UUID v7, nanoid และรหัสสุ่มที่กำหนดชุดอักขระเองได้ |

### Design & text · ออกแบบและข้อความ

| Tool | ทำอะไร |
| --- | --- |
| CSS Shadow & Gradient | ปรับเงาและไล่สีแบบเห็นผลจริงทันที แล้วคัดลอกโค้ด CSS ไปวางใช้ได้เลย |
| Aspect Ratio Calculator | หาขนาดที่คงอัตราส่วนเดิม พร้อมขนาดจริงของโซเชียลและค่าความเพี้ยนจากการปัดเศษ |
| Color Converter | แปลงสีระหว่าง HEX, RGB, HSL, HSV, OKLCH, CMYK พร้อมสร้างชุดสีเป็น CSS variable |
| Contrast Checker | ตรวจคอนทราสต์ทั้ง WCAG 2.x และ APCA พร้อมหาสีที่ใกล้ที่สุดที่ผ่านเกณฑ์ |
| Text Cleaner | ล้างช่องว่างเกิน อักขระล่องหน และปัญหาสระวรรณยุกต์ไทย แปลงเลขไทยกับอารบิก |
| Image Resizer & Compressor | ย่อและบีบอัดรูปในเครื่อง ดาวน์โหลดหลายไฟล์พร้อมกันเป็น zip |
| Thai Lorem Ipsum | สร้างข้อความตัวอย่างภาษาไทยที่อ่านแล้วดูเป็นธรรมชาติ พร้อมตัวเลือก seed |

## Running it

Needs Node 20+ and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm test` | The whole test suite |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm icons` | Redraw the app icons from the accent token |

Two audits need a production server running (`pnpm build && pnpm start`) in another
terminal:

```bash
node scripts/audit-a11y.mjs    # every page, every control
node scripts/lighthouse.mjs    # add "desktop" for the desktop profile
```

## How it is built

- **Next.js 16** (App Router, Turbopack), **React 19**, **Tailwind CSS v4**,
  **TypeScript** in strict mode.
- **Vitest** for tests. Anything that parses or sanitises HTML is tested under jsdom
  rather than happy-dom, because happy-dom is quietly wrong about it.
- Four runtime dependencies: `marked`, `dompurify`, `qrcode-generator` and
  `lucide-react`. Everything else — the diff, the zip writer, the QR payload, the
  spaced-repetition schedule, the PNG encoder for the icons — is written here.

### Layout

```
src/
  app/          Routes. One segment per tool, so a tool's code only
                loads on its own page.
  components/   Shared UI, the command palette, the layout shell.
  config/       The tool registry, categories, shared i18n.
  hooks/        useLocalStorage, useUrlState, and friends.
  lib/          Pure helpers: colour, dates, text segmentation, storage.
  tools/        One folder per tool: logic.ts, logic.test.ts, i18n.ts,
                index.tsx.
scripts/        Icon generation and the two audits.
```

Each tool keeps its logic in `logic.ts` as plain functions, so the interesting parts
are tested without rendering anything. `docs/TOOL_PATTERN.md` describes the
conventions a new tool follows, including the rules that came out of things that went
wrong.

## Deploying

The site is a stock Next.js app with no environment requirements beyond one optional
variable:

| Variable | Needed? | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical URLs, Open Graph, and `sitemap.xml`. Falls back to a placeholder. |

`next.config.ts` sets `X-Content-Type-Options`, `X-Frame-Options` and
`Referrer-Policy` on every route, and makes `/sw.js` uncacheable so a deploy cannot
strand an old service worker.

## License

MIT — see [LICENSE](LICENSE).
