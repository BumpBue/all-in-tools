import type { Metadata } from 'next';
import Link from 'next/link';

import { SITE_NAME } from '@/config/site';

// This page is served from the service worker cache, which was filled once at
// install time and never sees the visitor's later language choice. Saying it
// in both languages is what makes it right whichever way that went.
export const metadata: Metadata = {
  title: `ออฟไลน์ · Offline — ${SITE_NAME}`,
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">ยังไม่ได้เชื่อมต่อ</h1>
      <p className="text-sm text-muted">
        ตอนนี้เครื่องของคุณออฟไลน์อยู่ หน้าที่เคยเปิดไว้แล้วยังใช้ได้ตามปกติ
        ลองเชื่อมต่อใหม่แล้วโหลดหน้านี้อีกครั้ง
      </p>

      <hr className="border-border" />

      <h2 className="text-lg font-semibold tracking-tight">You are offline</h2>
      <p className="text-sm text-muted">
        Pages you have already opened still work. Reconnect and reload to reach the rest.
      </p>

      <Link
        href="/"
        className="mx-auto rounded-control bg-accent px-4 py-2 text-sm font-medium text-on-accent"
      >
        หน้าแรก · Home
      </Link>
    </div>
  );
}
