import { ToolCard } from '@/components/tool/tool-card';
import type { Tool } from '@/config/tools';

export function ToolGrid({ tools }: { tools: readonly Tool[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <li key={tool.slug} className="flex">
          <div className="w-full">
            <ToolCard tool={tool} />
          </div>
        </li>
      ))}
    </ul>
  );
}
