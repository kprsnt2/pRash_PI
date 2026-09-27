"use client";

import { MessageSquarePlus, Trash2, Lock, Sparkles } from "lucide-react";
import type { Agent, Conversation } from "@/lib/types";

export function Sidebar({
  conversations,
  activeId,
  agents,
  onSelect,
  onNew,
  onDelete,
  onClearAll,
}: {
  conversations: Conversation[];
  activeId: string | null;
  agents: Agent[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}) {
  const agentOf = (id: string) => agents.find((a) => a.id === id);

  return (
    <aside className="flex h-full w-[17rem] shrink-0 flex-col border-r border-[#26304a] bg-[#0d1322]/80">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/20 text-indigo-300">
          <Sparkles size={17} />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">pRash AI</div>
          <div className="text-[11px] text-[#6b7899]">
            {conversations.length} saved chat{conversations.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          <MessageSquarePlus size={16} /> New chat
        </button>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2">
        {conversations.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-[#6b7899]">
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
                active ? "bg-[#1b2438]" : "hover:bg-[#151c2e]"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
              >
                <span className="text-sm">{a?.emoji ?? "✨"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-[#dbe3f4]">
                    {c.title || "New chat"}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[#6b7899]">
                    {a?.name}
                    {c.isPrivate && (
                      <span className="flex items-center gap-0.5 text-amber-400/80">
                        <Lock size={9} /> private
                      </span>
                    )}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                className="mr-1 hidden h-7 w-7 shrink-0 place-items-center rounded-lg text-[#6b7899] hover:bg-rose-500/20 hover:text-rose-300 group-hover:grid"
                aria-label="Delete chat"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#26304a] p-3">
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
          <span className="grid h-6 place-items-center rounded-lg bg-[#1b2438] px-1.5 text-[10px] text-[#93a0bd]">
            +{Math.max(0, agents.length - 7)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClearAll}
          className="w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-[#6b7899] hover:bg-[#151c2e] hover:text-rose-300"
        >
          Clear all saved chats
        </button>
      </div>
    </aside>
  );
}
