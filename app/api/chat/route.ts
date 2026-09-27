import { getAgent } from "@/lib/agents";
import { buildCandidates, getProviders } from "@/lib/models";
import { ProviderError, streamModel, type LlmMessage } from "@/lib/providers";
import type { Attachment } from "@/lib/types";

export const maxDuration = 60;

interface IncomingMessage {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Attachment[];
}

interface ChatBody {
  agentId?: string;
  modelId?: string;
  isPrivate?: boolean;
  messages?: IncomingMessage[];
}

function sanitizeAttachments(list: Attachment[] | undefined): Attachment[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a && typeof a.name === "string")
    .slice(0, 10)
    .map((a) => ({
      id: String(a.id ?? crypto.randomUUID()),
      name: String(a.name).slice(0, 200),
      mime: String(a.mime ?? "application/octet-stream"),
      size: Number(a.size ?? 0),
      kind: a.kind === "image" || a.kind === "pdf" ? a.kind : "text",
      dataUrl: typeof a.dataUrl === "string" ? a.dataUrl : undefined,
      text:
        typeof a.text === "string" ? a.text.slice(0, 120_000) : undefined,
    }));
}

const enc = new TextEncoder();
function sse(obj: unknown): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const agent = getAgent(body.agentId);
  const isPrivate = !!body.isPrivate;

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  if (!incoming.length) {
    return new Response("No messages", { status: 400 });
  }

  const messages: LlmMessage[] = incoming
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : "",
      attachments: sanitizeAttachments(m.attachments),
    }));

  const last = messages[messages.length - 1];
  const needsVision = !!last?.attachments?.some((a) => a.kind === "image");
  const needsPdf = !!last?.attachments?.some((a) => a.kind === "pdf");

  const candidates = buildCandidates({
    modelId: body.modelId,
    isPrivate,
    needsVision,
    needsPdf,
    prefer: agent.prefer,
  });

  if (!candidates.length) {
    const msg = isPrivate
      ? "Private mode uses Gemini only, but no GEMINI_API_KEY is configured. Add one or turn private mode off."
      : needsPdf
        ? "No configured model can read PDFs. Add a GEMINI_API_KEY (Gemini reads PDFs natively)."
        : needsVision
          ? "No configured model supports images. Add an OpenAI or Gemini key."
          : "No provider API keys are configured. Add keys in your environment.";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const providers = getProviders();
  const signal = req.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const errors: string[] = [];
      let emitted = false;

      for (let i = 0; i < candidates.length; i++) {
        const model = candidates[i];
        const cfg = providers[model.provider];
        try {
          controller.enqueue(
            sse({
              type: "meta",
              model: model.id,
              modelLabel: model.label,
              provider: model.provider,
              fallbackFrom: i > 0 ? candidates[i - 1].id : undefined,
              attempt: i + 1,
              total: candidates.length,
            }),
          );

          for await (const delta of streamModel(model, cfg, {
            system: agent.systemPrompt,
            messages,
            signal,
          })) {
            if (delta) {
              emitted = true;
              controller.enqueue(sse({ type: "delta", text: delta }));
            }
          }

          controller.enqueue(
            sse({ type: "done", model: model.id, errors }),
          );
          controller.close();
          return;
        } catch (err) {
          if (signal.aborted) {
            try {
              controller.close();
            } catch {
              /* already closed */
            }
            return;
          }
          const message =
            err instanceof ProviderError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err);
          errors.push(`${model.label}: ${message}`);

          // If we already streamed partial text we cannot silently switch,
          // because the client would see mixed answers.
          if (emitted) {
            controller.enqueue(sse({ type: "error", message }));
            controller.close();
            return;
          }
          // otherwise fall through and try the next candidate
        }
      }

      controller.enqueue(
        sse({
          type: "error",
          message:
            "All providers failed. " +
            errors.map((e) => `(${e})`).join(" "),
        }),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
