"use client";

import { useRef } from "react";
import {
  MessageSquarePlus,
  Trash2,
  Lock,
  Sparkles,
  Download,
  Upload,
} from "lucide-react";
import type { Agent, Conversation } from "@/lib/types";

export function Sidebar({
  conversations,
  activeId,
  agents,
  onSelect,
  onNew,
  onDelete,
  onClearAll,
  onExport,
  onImport,
}: {
  conversations: Conversation[];
  activeId: string | null;
  agents: Agent[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onExport: (id: string) => void;
  onImport: (file: File) => void;
}) {
  const agentOf = (id: string) => agents.find((a) => a.id === id);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="flex h-full w-[17rem] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-deep)]/80">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/20 text-indigo-300">
          <Sparkles size={17} />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">pRash AI</div>
          <div className="text-[11px] text-[var(--faint)]">
            {conversations.length} saved chat{conversations.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-3">
        <button
          type="button"
          onClick={onNew}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          <MessageSquarePlus size={16} /> New chat
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="grid w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] transition hover:text-[var(--text)]"
          title="Import a chat (.json) and resume it"
        >
          <Upload size={15} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2">
        {conversations.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-[var(--faint)]">
            No saved chats yet. Private chats are never saved.
          </div>
        )}
        {conversations.map((c) => {
          const a = agentOf(c.agentId);
          const active = c.id === activeId;
          return (
            <div
              key={c.id}
              className={`group relative mb-0.5 flex items-center rounded-xl ${
                active ? "bg-[var(--panel-2)]" : "hover:bg-[var(--panel)]"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
              >
                <span className="text-sm">{a?.emoji ?? "✨"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-[var(--text-2)]">
                    {c.title || "New chat"}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[var(--faint)]">
                    {a?.name}
                    {c.isPrivate && (
                      <span className="flex items-center gap-0.5 text-amber-400/80">
                        <Lock size={9} /> private
                      </span>
                    )}
                  </span>
                </span>
              </button>
              <div className="mr-1 hidden shrink-0 items-center group-hover:flex">
                <button
                  type="button"
                  onClick={() => onExport(c.id)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-[var(--faint)] hover:bg-[var(--panel)] hover:text-[var(--text)]"
                  aria-label="Export chat"
                  title="Export chat"
                >
                  <Download size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-[var(--faint)] hover:bg-rose-500/20 hover:text-rose-300"
                  aria-label="Delete chat"
                  title="Delete chat"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {agents.slice(0, 7).map((a) => (
            <span
              key={a.id}
              title={`${a.name}: ${a.tagline}`}
              className="grid h-6 w-6 place-items-center rounded-lg text-xs"
              style={{ background: `${a.color}22` }}
            >
              {a.emoji}
            </span>
          ))}
          <span className="grid h-6 place-items-center rounded-lg bg-[var(--panel-2)] px-1.5 text-[10px] text-[var(--muted)]">
            +{Math.max(0, agents.length - 7)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClearAll}
          className="w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-[var(--faint)] hover:bg-[var(--panel)] hover:text-rose-300"
        >
          Clear all saved chats
        </button>
      </div>
    </aside>
  );
}
