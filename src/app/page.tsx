import { TOOL_COUNT } from '@/config/tools';

export default function HomePage() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-display font-semibold">Toolbox</h1>
      <p className="text-muted">
        เครื่องมือ {TOOL_COUNT} ตัว — หน้าแรกจริงมาในขั้นถัดไป
      </p>
    </div>
  );
}
