"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { Agent } from "@/lib/types";

export function useClickOutside<T extends HTMLElement>(
  onClose: () => void,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

export function AgentPicker({
  agents,
  value,
  onChange,
}: {
  agents: Agent[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const active = agents.find((a) => a.id === value);

  const filtered = agents.filter((a) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      a.name.toLowerCase().includes(s) ||
      a.tagline.toLowerCase().includes(s) ||
      a.category.toLowerCase().includes(s)
    );
  });
  const categories = Array.from(new Set(filtered.map((a) => a.category)));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-[#26304a] bg-[#151c2e] px-3 py-2 text-sm font-medium hover:border-[#3a4870]"
      >
        <span
          className="grid h-6 w-6 place-items-center rounded-lg text-base"
          style={{ background: `${active?.color ?? "#6366f1"}22` }}
        >
          {active?.emoji ?? "✨"}
        </span>
        <span className="max-w-[9rem] truncate">{active?.name ?? "Agent"}</span>
        <ChevronDown size={15} className="text-[#93a0bd]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-[#26304a] bg-[#111726] shadow-2xl shadow-black/50 fade-up">
          <div className="flex items-center gap-2 border-b border-[#26304a] px-3 py-2">
            <Search size={15} className="text-[#93a0bd]" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search agents…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#6b7899]"
            />
          </div>
          <div className="max-h-[24rem] overflow-y-auto p-1.5">
            {categories.map((cat) => (
              <div key={cat} className="mb-1">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#6b7899]">
                  {cat}
                </div>
                {filtered
                  .filter((a) => a.category === cat)
                  .map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        onChange(a.id);
                        setOpen(false);
                      }}
                      className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-[#1b2438]"
                    >
                      <span
                        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-base"
                        style={{ background: `${a.color}22` }}
                      >
                        {a.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{a.name}</span>
                          {a.id === value && (
                            <Check size={13} className="text-indigo-400" />
                          )}
                        </span>
                        <span className="block truncate text-xs text-[#93a0bd]">
                          {a.tagline}
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
            ))}
            {!filtered.length && (
              <div className="px-3 py-6 text-center text-sm text-[#93a0bd]">
                No agents found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
