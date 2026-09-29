"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUp,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Square,
  X,
  FileText,
  File as FileIcon,
} from "lucide-react";
import type { Attachment } from "@/lib/types";
import {
  useSpeechRecognition,
  isSpeechRecognitionSupported,
} from "@/lib/useSpeechRecognition";
import {
  fileToAttachment,
  humanSize,
  totalAttachmentBytes,
  MAX_TOTAL_BYTES,
} from "@/lib/files";

function AttachmentChip({
  a,
  onRemove,
}: {
  a: Attachment;
  onRemove: (id: string) => void;
}) {
  const isImage = a.kind === "image" && a.dataUrl;
  return (
    <div className="group relative flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-1.5 pr-2">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.dataUrl}
          alt={a.name}
          className="h-9 w-9 rounded-lg object-cover"
        />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--panel-2)] text-[var(--muted)]">
          {a.kind === "pdf" ? <FileText size={16} /> : <FileIcon size={16} />}
        </span>
      )}
      <span className="max-w-[9rem]">
        <span className="block truncate text-xs font-medium">{a.name}</span>
        <span className="block text-[10px] text-[var(--muted)]">
          {humanSize(a.size)}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onRemove(a.id)}
        className="ml-0.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--border)] text-[var(--muted)] hover:bg-rose-500/80 hover:text-[var(--text)]"
        aria-label={`Remove ${a.name}`}
      >
        <X size={11} />
      </button>
    </div>
  );
}

export function Composer({
  onSend,
  onStop,
  isStreaming,
  disabled,
  isPrivate,
}: {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  isPrivate: boolean;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [interim, setInterim] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attsRef = useRef<Attachment[]>([]);
  attsRef.current = attachments;
  const [micSupported, setMicSupported] = useState(false);

  const speech = useSpeechRecognition({
    lang: "en-IN",
    onFinal: (t) => {
      setInterim("");
      setText((prev) => (prev ? `${prev} ${t}` : t));
    },
    onInterim: setInterim,
    onError: (msg) => setErrors((prev) => [...new Set([...prev, msg])]),
  });

  useEffect(() => {
    setMicSupported(isSpeechRecognitionSupported());
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 260)}px`;
  }, [text]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 10);
    if (!arr.length) return;
    setBusy(true);
    const added: Attachment[] = [];
    const errs: string[] = [];
    let total = totalAttachmentBytes(attsRef.current);
    for (const f of arr) {
      const res = await fileToAttachment(f);
      if (res.attachment) {
        const next = total + res.attachment.size;
        if (next > MAX_TOTAL_BYTES) {
          errs.push(
            `${f.name}: skipped — total attachments would exceed 3MB`,
          );
          continue;
        }
        total = next;
        added.push(res.attachment);
      }
      if (res.error) errs.push(res.error);
    }
    setAttachments((prev) => [...prev, ...added].slice(0, 10));
    setErrors(errs);
    setBusy(false);
  }, []);

  const remove = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const submit = () => {
    const t = text.trim();
    if ((!t && !attachments.length) || isStreaming || disabled) return;
    onSend(t, attachments);
    setText("");
    setAttachments([]);
    setErrors([]);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files || []);
    if (files.length) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  };

  const canSend = (text.trim() || attachments.length) && !disabled;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative rounded-3xl border bg-[var(--bg-soft)]/90 backdrop-blur transition ${
        dragging ? "border-indigo-400 ring-2 ring-indigo-500/30" : "border-[var(--border)]"
      }`}
    >
      {(attachments.length > 0 || errors.length > 0) && (
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] p-2.5">
          {attachments.map((a) => (
            <AttachmentChip key={a.id} a={a} onRemove={remove} />
          ))}
          {errors.map((e) => (
            <div
              key={e}
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300"
            >
              {e}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-2.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
          title="Attach images, PDF or text"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept="image/*,application/pdf,.txt,.csv,.md,.json,.log"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {micSupported && (
          <button
            type="button"
            onClick={speech.toggle}
            disabled={disabled}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition ${
              speech.listening
                ? "bg-rose-500/20 text-rose-300"
                : "text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
            }`}
            title={speech.listening ? "Stop dictation" : "Speak your message"}
          >
            {speech.listening ? (
              <MicOff size={18} className="animate-pulse" />
            ) : (
              <Mic size={18} />
            )}
          </button>
        )}

        {interim && (
          <div className="pointer-events-none absolute -top-6 left-16 rounded-lg bg-[var(--panel-2)] px-2 py-0.5 text-[11px] text-indigo-200">
            {interim}…
          </div>
        )}

        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          rows={1}
          disabled={disabled}
          placeholder={
            isPrivate
              ? "Private chat — routed to Gemini only…"
              : "Message your agent…  (Enter to send, Shift+Enter for newline)"
          }
          className="max-h-[260px] min-h-[2.5rem] flex-1 resize-none bg-transparent px-1 py-2 text-[0.95rem] leading-relaxed outline-none placeholder:text-[var(--faint)] disabled:opacity-60"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--border)] text-white hover:bg-[var(--border-strong)]"
            title="Stop"
          >
            <Square size={15} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-[var(--border)] disabled:text-[var(--faint)]"
            title="Send"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
