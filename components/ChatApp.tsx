"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Lock,
  Unlock,
  Printer,
  Menu,
  LogOut,
  Loader2,
  Zap,
  X,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Download,
} from "lucide-react";
import type {
  Agent,
  Attachment,
  ChatMessage,
  Conversation,
  ModelInfo,
  ProviderId,
} from "@/lib/types";
import {
  deleteConversation,
  listConversations,
  saveConversation,
  clearAll,
  loadSettings,
  saveSettings,
} from "@/lib/storage";
import {
  speakText,
  cancelSpeech,
  isSpeechSynthesisSupported,
  primeVoices,
} from "@/lib/speech";
import { AgentPicker } from "./AgentPicker";
import { ModelPicker } from "./ModelPicker";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { Sidebar } from "./Sidebar";
import { PrintModal } from "./PrintModal";
import { exportConversation, importConversation } from "@/lib/exchange";

interface MetaState {
  agents: Agent[];
  models: ModelInfo[];
  configured: ProviderId[];
  authEnabled: boolean;
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function titleFrom(text: string, atts: Attachment[]): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t) return t.length > 44 ? `${t.slice(0, 44)}…` : t;
  if (atts.length) return atts[0].name;
  return "New chat";
}

function newConversation(
  agentId: string,
  modelId: string,
  isPrivate: boolean,
): Conversation {
  const now = Date.now();
  return {
    id: uid(),
    title: "",
    agentId,
    modelId,
    isPrivate,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function ChatApp() {
  const [meta, setMeta] = useState<MetaState>({
    agents: [],
    models: [],
    configured: [],
    authEnabled: false,
  });
  const [metaError, setMetaError] = useState<string | null>(null);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [printOpen, setPrintOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const convosRef = useRef<Conversation[]>([]);
  convosRef.current = convos;
  const autoSpeakRef = useRef(false);
  autoSpeakRef.current = autoSpeak;

  const active = useMemo(
    () => convos.find((c) => c.id === activeId) ?? null,
    [convos, activeId],
  );

  const activeAgent = useMemo(() => {
    const id = active?.agentId ?? "general";
    return meta.agents.find((a) => a.id === id);
  }, [active, meta.agents]);

  /* ------------------------------ bootstrap ------------------------------ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/models");
        if (!res.ok) throw new Error("Could not load configuration");
        const data = await res.json();
        if (cancelled) return;
        setMeta({
          agents: data.agents ?? [],
          models: data.models ?? [],
          configured: data.configuredProviders ?? [],
          authEnabled: !!data.authEnabled,
        });

        const saved = await listConversations();
        if (cancelled) return;
        setConvos(saved);

        const settings = loadSettings();
        if (settings.autoSpeak) setAutoSpeak(true);
        if (saved.length) {
          setActiveId(saved[0].id);
        } else {
          const agentId =
            settings.agentId && data.agents?.some((a: Agent) => a.id === settings.agentId)
              ? settings.agentId
              : "general";
          const c = newConversation(
            agentId,
            settings.modelId ?? "auto",
            !!settings.isPrivate,
          );
          setConvos([c]);
          setActiveId(c.id);
        }
      } catch (e) {
        if (!cancelled)
          setMetaError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* --------------------------- speech bootstrap -------------------------- */
  useEffect(() => {
    setSpeechSupported(isSpeechSynthesisSupported());
    primeVoices();
    return () => cancelSpeech();
  }, []);

  /* ------------------------------- theme --------------------------------- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("prash-ai:theme");
      const t =
        saved === "light" || saved === "dark"
          ? saved
          : window.matchMedia?.("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark";
      setTheme(t);
      document.documentElement.classList.toggle("light", t === "light");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("light", next === "light");
      try {
        localStorage.setItem("prash-ai:theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  /* --------------------------- persist settings -------------------------- */
  useEffect(() => {
    if (!active) return;
    saveSettings({
      agentId: active.agentId,
      modelId: active.modelId,
      isPrivate: active.isPrivate,
      autoSpeak,
    });
  }, [active, autoSpeak]);

  /* ------------------------------- speaking ------------------------------ */
  const speakAssistant = useCallback(
    (msgId: string, text: string, agentId: string) => {
      cancelSpeech();
      const isKid = agentId === "kidstory";
      const ok = speakText(text, {
        rate: isKid ? 0.88 : 1.0,
        pitch: isKid ? 1.08 : 1.0,
        onEnd: () => setSpeakingId((cur) => (cur === msgId ? null : cur)),
      });
      setSpeakingId(ok ? msgId : null);
    },
    [],
  );

  /* ------------------------------- scrolling ----------------------------- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 220;
    if (nearBottom || streamingMsgId) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [active?.messages, streamingMsgId]);

  /* ------------------------------ mutations ------------------------------ */
  const updateActive = useCallback(
    (fn: (c: Conversation) => Conversation) => {
      setConvos((prev) =>
        prev.map((c) => (c.id === activeId ? fn(c) : c)),
      );
    },
    [activeId],
  );

  const persist = useCallback((conv: Conversation) => {
    if (conv.isPrivate) return;
    void saveConversation(conv);
  }, []);

  const handleNew = useCallback(() => {
    abortRef.current?.abort();
    setStreamingMsgId(null);
    cancelSpeech();
    setSpeakingId(null);
    const current = convosRef.current.find((c) => c.id === activeId);
    // Reuse an empty unsaved chat instead of piling up blanks.
    if (!(current && current.messages.length === 0)) {
      const c = newConversation(
        active?.agentId ?? "general",
        active?.modelId ?? "auto",
        active?.isPrivate ?? false,
      );
      setConvos((prev) => [c, ...prev]);
      setActiveId(c.id);
    }
    setSidebarOpen(false);
  }, [active, activeId]);

  const handleDelete = useCallback(
    (id: string) => {
      void deleteConversation(id);
      const next = convosRef.current.filter((c) => c.id !== id);
      if (next.length === 0) {
        const c = newConversation("general", "auto", false);
        setConvos([c]);
        setActiveId(c.id);
        return;
      }
      setConvos(next);
      if (id === activeId) setActiveId(next[0].id);
    },
    [activeId],
  );

  const handleExport = useCallback((id: string) => {
    const conv = convosRef.current.find((c) => c.id === id);
    if (conv) exportConversation(conv);
  }, []);

  const handleImport = useCallback(async (file: File) => {
    try {
      const conv = await importConversation(file);
      setConvos((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      persist(conv);
      setNotice(`Imported "${conv.title}" — you can continue the chat.`);
      setSidebarOpen(false);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not import that file.");
    }
  }, [persist]);

  const handleClearAll = useCallback(() => {
    if (!confirm("Delete all saved chats? This cannot be undone.")) return;
    void clearAll();
    const c = newConversation("general", "auto", false);
    setConvos([c]);
    setActiveId(c.id);
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setStreamingMsgId(null);
  }, []);

  const handleToggleSpeak = useCallback(
    (msg: ChatMessage) => {
      if (speakingId === msg.id) {
        cancelSpeech();
        setSpeakingId(null);
        return;
      }
      speakAssistant(msg.id, msg.content, msg.agentId ?? active?.agentId ?? "general");
    },
    [speakingId, speakAssistant, active],
  );

  /* ------------------------------- streaming ----------------------------- */
  const streamInto = useCallback(
    async (
      convId: string,
      assistantMsgId: string,
      requestMessages: ChatMessage[],
      agentId: string,
      modelId: string,
      isPrivate: boolean,
    ) => {
      const ac = new AbortController();
      abortRef.current = ac;
      setStreamingMsgId(assistantMsgId);
      setNotice(null);

      const patch = (
        updater: (m: ChatMessage) => ChatMessage,
        convUpdater?: (c: Conversation) => Conversation,
      ) => {
        setConvos((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c;
            let next: Conversation = {
              ...c,
              messages: c.messages.map((m) =>
                m.id === assistantMsgId ? updater(m) : m,
              ),
            };
            if (convUpdater) next = convUpdater(next);
            return next;
          }),
        );
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            modelId,
            isPrivate,
            messages: requestMessages.map((m) => ({
              role: m.role,
              content: m.content,
              attachments: m.attachments,
            })),
          }),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          let msg = `Request failed (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleEvent = (ev: {
          type: string;
          text?: string;
          message?: string;
          model?: string;
          modelLabel?: string;
          provider?: ProviderId;
          fallbackFrom?: string;
          fallbackReason?: string;
          attempt?: number;
          total?: number;
          elapsedMs?: number;
          usage?: { promptTokens?: number; completionTokens?: number };
        }) => {
          if (ev.type === "meta") {
            patch((m) => ({
              ...m,
              modelId: ev.model,
              stats: {
                ...m.stats,
                modelId: ev.model,
                modelLabel: ev.modelLabel,
                provider: ev.provider,
                attempts: ev.attempt,
                totalCandidates: ev.total,
                fallbackFrom: ev.fallbackFrom,
                fallbackReason: ev.fallbackReason,
              },
            }));
            if (ev.attempt && ev.attempt > 1) {
              setNotice(
                `Primary model unavailable — auto-routed to ${ev.modelLabel ?? ev.model}.`,
              );
            }
          } else if (ev.type === "delta" && ev.text) {
            patch((m) => ({ ...m, content: m.content + ev.text }));
          } else if (ev.type === "done") {
            patch((m) => ({
              ...m,
              stats: {
                ...m.stats,
                modelId: ev.model ?? m.stats?.modelId,
                modelLabel: ev.modelLabel ?? m.stats?.modelLabel,
                provider: ev.provider ?? m.stats?.provider,
                elapsedMs: ev.elapsedMs,
                promptTokens: ev.usage?.promptTokens,
                completionTokens: ev.usage?.completionTokens,
                attempts: ev.attempt ?? m.stats?.attempts,
                totalCandidates: ev.total ?? m.stats?.totalCandidates,
                fallbackFrom: ev.fallbackFrom ?? m.stats?.fallbackFrom,
                fallbackReason: ev.fallbackReason ?? m.stats?.fallbackReason,
              },
            }));
          } else if (ev.type === "error") {
            patch((m) => ({
              ...m,
              error: true,
              content:
                m.content +
                (m.content ? "\n\n" : "") +
                `⚠️ ${ev.message ?? "Something went wrong."}`,
            }));
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              handleEvent(JSON.parse(data));
            } catch {
              /* ignore malformed */
            }
          }
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          const message = e instanceof Error ? e.message : String(e);
          patch((m) => ({
            ...m,
            error: true,
            content:
              m.content +
              (m.content ? "\n\n" : "") +
              `⚠️ ${message}`,
          }));
        }
      } finally {
        setStreamingMsgId(null);
        abortRef.current = null;
        const conv = convosRef.current.find((c) => c.id === convId);
        if (conv) {
          persist(conv);
          if (autoSpeakRef.current) {
            const last = conv.messages[conv.messages.length - 1];
            if (
              last &&
              last.id === assistantMsgId &&
              last.role === "assistant" &&
              last.content &&
              !last.error
            ) {
              speakAssistant(last.id, last.content, conv.agentId);
            }
          }
        }
      }
    },
    [persist, speakAssistant],
  );

  const handleSend = useCallback(
    (text: string, attachments: Attachment[]) => {
      if (!active) return;
      cancelSpeech();
      setSpeakingId(null);
      const agentId = active.agentId;
      const modelId = active.modelId;
      const isPrivate = active.isPrivate;

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        attachments: attachments.length ? attachments : undefined,
        createdAt: Date.now(),
      };
      const asstMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        agentId,
      };

      const requestMessages = [...active.messages, userMsg];
      const title = active.title || titleFrom(text, attachments);

      setConvos((prev) =>
        prev.map((c) =>
          c.id === active.id
            ? {
                ...c,
                title,
                updatedAt: Date.now(),
                messages: [...c.messages, userMsg, asstMsg],
              }
            : c,
        ),
      );
      setSidebarOpen(false);

      void streamInto(active.id, asstMsg.id, requestMessages, agentId, modelId, isPrivate);
    },
    [active, streamInto],
  );

  const handleRegenerate = useCallback(
    (assistantMsgId: string) => {
      if (!active || streamingMsgId) return;
      const idx = active.messages.findIndex((m) => m.id === assistantMsgId);
      if (idx < 0) return;
      const requestMessages = active.messages.slice(0, idx);
      if (!requestMessages.length) return;

      const fresh: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        agentId: active.agentId,
      };
      setConvos((prev) =>
        prev.map((c) =>
          c.id === active.id
            ? {
                ...c,
                messages: [...requestMessages, fresh],
                updatedAt: Date.now(),
              }
            : c,
        ),
      );
      void streamInto(
        active.id,
        fresh.id,
        requestMessages,
        active.agentId,
        active.modelId,
        active.isPrivate,
      );
    },
    [active, streamingMsgId, streamInto],
  );

  /* ------------------------------- setters ------------------------------- */
  const setAgent = useCallback(
    (id: string) => updateActive((c) => ({ ...c, agentId: id, updatedAt: Date.now() })),
    [updateActive],
  );

  const setModel = useCallback(
    (id: string) => updateActive((c) => ({ ...c, modelId: id, updatedAt: Date.now() })),
    [updateActive],
  );

  const togglePrivate = useCallback(() => {
    const cur = convosRef.current.find((c) => c.id === activeId);
    if (!cur) return;
    const isPrivate = !cur.isPrivate;
    if (isPrivate) void deleteConversation(cur.id);
    setConvos((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, isPrivate, modelId: isPrivate ? "auto" : c.modelId }
          : c,
      ),
    );
    setNotice(null);
  }, [activeId]);

  const logout = useCallback(async () => {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }, []);

  /* -------------------------------- render ------------------------------- */
  if (!ready) {
    return (
      <div className="grid h-dvh place-items-center text-[var(--muted)]">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 size={18} className="animate-spin" /> Loading pRash AI…
        </div>
      </div>
    );
  }

  if (metaError) {
    return (
      <div className="grid h-dvh place-items-center px-6 text-center">
        <div>
          <div className="mb-2 text-lg font-semibold text-rose-300">
            Setup problem
          </div>
          <p className="max-w-md text-sm text-[var(--muted)]">{metaError}</p>
        </div>
      </div>
    );
  }

  const agent = activeAgent ?? meta.agents.find((a) => a.id === "general");
  const messages = active?.messages ?? [];
  const isEmpty = messages.length === 0;
  const noProviders = meta.configured.length === 0;

  const agentFor = (agentId?: string) =>
    meta.agents.find((a) => a.id === (agentId ?? active?.agentId)) ??
    agent ??
    meta.agents[0];

  return (
    <div className="app-root flex h-dvh overflow-hidden">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform lg:static lg:translate-x-0 no-print ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          conversations={convos}
          activeId={activeId}
          agents={meta.agents}
          onSelect={(id) => {
            setActiveId(id);
            setSidebarOpen(false);
          }}
          onNew={handleNew}
          onDelete={handleDelete}
          onClearAll={handleClearAll}
          onExport={handleExport}
          onImport={handleImport}
        />
      </div>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5 no-print">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--panel-2)] lg:hidden"
          >
            <Menu size={18} />
          </button>

          <AgentPicker
            agents={meta.agents}
            value={active?.agentId ?? "general"}
            onChange={setAgent}
          />
          <ModelPicker
            models={meta.models}
            value={active?.modelId ?? "auto"}
            onChange={setModel}
            isPrivate={active?.isPrivate ?? false}
            configured={meta.configured}
          />

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePrivate}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition ${
                active?.isPrivate
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}
              title={
                active?.isPrivate
                  ? "Private mode ON — Gemini only, not saved"
                  : "Turn on private mode (Gemini only, not saved)"
              }
            >
              {active?.isPrivate ? <Lock size={13} /> : <Unlock size={13} />}
              <span className="hidden sm:inline">
                {active?.isPrivate ? "Private" : "Normal"}
              </span>
            </button>
            {speechSupported && (
              <button
                type="button"
                onClick={() => {
                  setAutoSpeak((v) => {
                    const next = !v;
                    if (!next) {
                      cancelSpeech();
                      setSpeakingId(null);
                    }
                    return next;
                  });
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition ${
                  autoSpeak
                    ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                    : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--text)]"
                }`}
                title={
                  autoSpeak
                    ? "Auto-read replies is ON"
                    : "Auto-read new replies aloud"
                }
              >
                {autoSpeak ? <Volume2 size={13} /> : <VolumeX size={13} />}
                <span className="hidden md:inline">Read</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => active && handleExport(active.id)}
              disabled={!active || !active.messages.length}
              className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)] disabled:opacity-40"
              title="Export chat (.json) — import it later to resume"
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPrintOpen(true)}
              disabled={!active || !active.messages.length}
              className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)] disabled:opacity-40"
              title="Print / save as PDF (with optional answer key)"
            >
              <Printer size={16} />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {meta.authEnabled && (
              <button
                type="button"
                onClick={logout}
                className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                title="Log out"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </header>

        {noProviders && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200 no-print">
            No API keys configured. Add at least one of OPENAI_API_KEY,
            GEMINI_API_KEY, GROQ_API_KEY or NVIDIA_API_KEY, then redeploy.
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {isEmpty ? (
              <div className="fade-up">
                <div
                  className="mb-4 grid h-14 w-14 place-items-center rounded-2xl text-3xl"
                  style={{ background: `${agent?.color ?? "#6366f1"}22` }}
                >
                  {agent?.emoji}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {agent?.name}
                </h1>
                <p className="mt-1 max-w-lg text-sm text-[var(--muted)]">
                  {agent?.description}
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {agent?.starters.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSend(s, [])}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3 text-left text-sm text-[var(--text-2)] transition hover:border-indigo-500/50 hover:bg-[var(--panel-2)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-6 flex items-center gap-1.5 text-[11px] text-[var(--faint)]">
                  <Zap size={12} className="text-amber-400" />
                  Attach images, PDFs and text files — up to 10 per message.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {notice && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200 no-print">
                    <span>{notice}</span>
                    <button type="button" onClick={() => setNotice(null)}>
                      <X size={13} />
                    </button>
                  </div>
                )}
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    msg={m}
                    agent={agentFor(m.agentId)}
                    modelLabel={
                      m.stats?.modelLabel ??
                      meta.models.find((x) => x.id === m.modelId)?.label ??
                      m.modelId
                    }
                    streaming={streamingMsgId === m.id}
                    speaking={speakingId === m.id}
                    speechSupported={speechSupported}
                    onToggleSpeak={
                      m.role === "assistant" && m.content
                        ? () => handleToggleSpeak(m)
                        : undefined
                    }
                    onRegenerate={
                      m.role === "assistant" && !streamingMsgId
                        ? () => handleRegenerate(m.id)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--bg)]/60 px-3 pb-3 pt-3 no-print">
          <div className="mx-auto w-full max-w-3xl">
            <Composer
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={!!streamingMsgId}
              disabled={noProviders}
              isPrivate={active?.isPrivate ?? false}
            />
            <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-[var(--faint)]">
              <span>Files are sent to the active model to generate the reply</span>
              {active?.isPrivate && (
                <span className="text-amber-400/80">
                  Private: Gemini only · not saved
                </span>
              )}
            </div>
          </div>
        </div>
      </main>

      {printOpen && active && (
        <PrintModal
          convo={active}
          agent={agent}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </div>
  );
}
