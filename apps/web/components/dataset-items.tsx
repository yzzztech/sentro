"use client";

import Link from "next/link";
import { useState } from "react";

interface DatasetItem {
  id: string;
  input: unknown;
  expectedOutput: unknown;
  sourceRunId: string | null;
  createdAt: Date;
}

interface DatasetItemsProps {
  items: DatasetItem[];
  projectId: string;
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function CollapsibleJson({ label, value }: { label: string; value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const formatted = formatJson(value);
  const isEmpty = value === null || value === undefined;

  return (
    <div className="border border-gray-800 rounded bg-gray-950/60">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-900/40 transition-colors"
        disabled={isEmpty}
      >
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-xs text-gray-500">
          {isEmpty ? "—" : expanded ? "hide" : "show"}
        </span>
      </button>
      {expanded && !isEmpty && (
        <pre className="px-3 pb-3 pt-0 text-xs text-gray-300 font-mono overflow-auto max-h-80">
          {formatted}
        </pre>
      )}
    </div>
  );
}

export default function DatasetItems({ items, projectId }: DatasetItemsProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed border-gray-800 rounded-lg">
        <p className="text-gray-500 text-lg">No items in this dataset</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="border border-gray-800 rounded-lg p-4 bg-gray-900/40 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="font-mono">{item.id.slice(0, 8)}</span>
              <span>·</span>
              <span>{timeAgo(item.createdAt)}</span>
            </div>
            {item.sourceRunId && (
              <Link
                href={`/${projectId}/runs/${item.sourceRunId}`}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                source run →
              </Link>
            )}
          </div>
          <CollapsibleJson label="Input" value={item.input} />
          <CollapsibleJson label="Expected Output" value={item.expectedOutput} />
        </div>
      ))}
    </div>
  );
}
