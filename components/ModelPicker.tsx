"use client";

import { useState } from "react";
import { Check, ChevronDown, Image as ImageIcon, FileText, Zap } from "lucide-react";
import type { ModelInfo, ProviderId } from "@/lib/types";
import { useClickOutside } from "./AgentPicker";

const PROVIDER_LABEL: Record<ProviderId, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  nvidia: "NVIDIA NIM",
  groq: "Groq",
};

export function ModelPicker({
  models,
  value,
  onChange,
  isPrivate,
  configured,
}: {
  models: ModelInfo[];
  value: string;
  onChange: (id: string) => void;
  isPrivate: boolean;
  configured: ProviderId[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const active = models.find((m) => m.id === value);
  const has = (p: ProviderId) => configured.includes(p);

  const groups: ProviderId[] = ["openai", "gemini", "groq", "nvidia"];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm hover:border-[var(--quote-border)]"
      >
        <span className="flex items-center gap-1.5">
          {value === "auto" ? (
            <>
              <Zap size={14} className="text-amber-400" />
              <span className="max-w-[7rem] truncate">Auto route</span>
            </>
          ) : (
            <span className="max-w-[11rem] truncate">
              {active?.label ?? value}
            </span>
          )}
        </span>
        <ChevronDown size={15} className="text-[var(--muted)]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[21rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] shadow-2xl shadow-black/50 fade-up">
          <div className="max-h-[26rem] overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => {
                onChange("auto");
                setOpen(false);
              }}
              className="mb-1 flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-[var(--panel-2)]"
            >
              <Zap size={16} className="mt-0.5 shrink-0 text-amber-400" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  Auto route {value === "auto" && <Check size={13} />}
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  {isPrivate
                    ? "Gemini only (data not used for training)"
                    : "OpenAI → Gemini → Groq → NVIDIA, with automatic fallback"}
                </span>
              </span>
            </button>

            {groups.map((p) => {
              const items = models.filter((m) => m.provider === p);
              if (!items.length) return null;
              return (
                <div key={p} className="mb-1">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
                      {PROVIDER_LABEL[p]}
                    </span>
                    {!has(p) && (
                      <span className="text-[10px] text-rose-400/80">
                        no API key
                      </span>
                    )}
                  </div>
                  {items.map((m) => {
                    const disabled = isPrivate
                      ? m.provider !== "gemini" || !has("gemini")
                      : false;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          onChange(m.id);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm ${
                          disabled
                            ? "cursor-not-allowed opacity-40"
                            : "hover:bg-[var(--panel-2)]"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {m.model}
                        </span>
                        {m.vision && (
                          <ImageIcon
                            size={13}
                            className="shrink-0 text-emerald-400/80"
                          />
                        )}
                        {m.pdf && (
                          <FileText
                            size={13}
                            className="shrink-0 text-sky-400/80"
                          />
                        )}
                        {value === m.id && (
                          <Check size={13} className="shrink-0 text-indigo-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {isPrivate && (
            <div className="border-t border-[var(--border)] bg-[var(--bg-raise)] px-3 py-2 text-[11px] text-[var(--muted)]">
              Private mode locks routing to Gemini so your paid key never
              trains on your data.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
