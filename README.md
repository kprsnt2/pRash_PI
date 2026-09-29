# pRash AI — all-in-one private chat

A personal, multi-agent AI chat app. Pick an **agent** (like a plugin) and a
**model** (or let it auto-route with fallback), attach lots of files, and chat.
Built with Next.js 15, deployable free on Vercel. No database required. 

---

## Features

- **Agent picker** — 18 built-in specialist agents (KidStory, StudyBuddy,
  Worksheet, DataAnalyst, Doctor, Psycho, Spiritual, CodeMentor, Writer,
  Translator, Meal, Travel, Finance, Fitness, Career, LegalLite, Summarizer,
  Allrounder). Each has its own system prompt, starter prompts and preferred
  model.
- **Model picker + automatic fallback** — default **Auto route**:
  `OpenAI → Gemini → Groq → NVIDIA`. If a provider errors or its key is
  missing, it silently tries the next one. You can also pin a specific model.
- **Attachments** — up to 10 per message: images, PDFs and text/code files.
  Paste from clipboard or drag-and-drop. PDFs are read natively by Gemini;
  images work on all vision-capable models. Large photos are **auto-resized
  in the browser** (max 1600px, JPEG) so phone pictures fit under the limit.
- **Voice** — dictate messages with the mic button (Web Speech) and click
  **Listen** on any reply to hear it. The header **Read** toggle auto-reads
  every new reply; KidStory slows the voice down for kids.
- **Privacy / temporary mode** — one toggle locks routing to **Gemini only** and
  stops the conversation from ever being saved. Designed for your paid Gemini
  key that does not train on your data.
- **Markdown + math** — code blocks with copy button, tables, GFM and KaTeX.
- **Dark / light mode** — one-click theme toggle, remembered per browser.
- **Reply stats** — every answer shows the model that served it, response
  time and token usage (estimated when a provider does not report it). When
  auto-routing switched providers, the reason is shown under the reply.
- **Switch agent mid-chat** — the agent picker works at any time; each reply
  remembers which agent produced it.
- **Export / import chats** — download any chat as a `.json` file and import
  it later (or on another device) to resume the session.
- **Print / PDF** — clean A4 preview with Name/Date/Score header. Answer keys
  are detected automatically and can be hidden with one toggle, then printed
  on a separate page. Perfect for the Worksheet agent.
- **Local-only history** — conversations live in your browser (IndexedDB).
  Nothing is stored on the server. Private chats are never saved.
- **Optional passcode gate** for public deployments.

---

## Quick start (local)

```bash
npm install
cp .env.example .env.local     # then edit .env.local
npm run dev
```

Open http://localhost:3000.

You only need **one** provider key to start. Add more to unlock the fallback
chain. Missing keys are skipped automatically.

### Where to get keys

| Provider | Env var | Get it at |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| Google Gemini | `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey |
| Groq | `GROQ_API_KEY` | https://console.groq.com/keys |
| NVIDIA NIM | `NVIDIA_API_KEY` | https://build.nvidia.com |

---

## Model configuration (no code changes needed)

Model names are **environment driven**, so you can change them any time on
Vercel without editing or redeploying code (just edit env and redeploy).

```env
OPENAI_MODELS=gpt-5-mini,gpt-5-nano,gpt-5,gpt-4.1-mini
GEMINI_MODELS=gemini-flash-latest,gemini-2.5-flash,gemini-2.5-pro
GROQ_MODELS=llama-3.3-70b-versatile,llama-3.1-8b-instant,qwen/qwen3-32b
NVIDIA_MODELS=meta/llama-3.3-70b-instruct,meta/llama-3.1-8b-instruct,deepseek-ai/deepseek-r1
```

> **Note on `gpt-5.4-mini` / `gpt-5.4-nano`:** those model ids don't exist.
> The real OpenAI family is `gpt-5`, `gpt-5-mini`, `gpt-5-nano` — so the app
> defaults to `gpt-5-mini` then `gpt-5-nano`. If you want different ids, put
> them in `OPENAI_MODELS`. The first entry is the primary; the rest are
> fallbacks. Exact model availability depends on your OpenAI account access.

**Pin a default model per provider** (optional) — bypasses the first entry
of the list without editing it:

```env
OPENAI_DEFAULT_MODEL=gpt-5-nano
GEMINI_DEFAULT_MODEL=gemini-2.5-flash
GROQ_DEFAULT_MODEL=llama-3.3-70b-versatile
NVIDIA_DEFAULT_MODEL=meta/llama-3.3-70b-instruct
```

**Custom fallback order** (optional):

```env
AUTO_ROUTE=openai:gpt-5-mini,openai:gpt-5-nano,gemini:gemini-flash-latest,groq:llama-3.3-70b-versatile,nvidia:meta/llama-3.3-70b-instruct
```

**Capability flags** for models added via env are auto-detected:
- Gemini models → images + PDF.
- OpenAI `gpt-4*`, `gpt-5*`, `o1/o3/o4*` → images.
- Groq/NVIDIA models containing `vision`, `scout`, `maverick`, `vila`, `neva` → images.

---

## Deploy to Vercel (recommended)

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project → import the repo**. Framework is detected as
   Next.js automatically.
3. Add Environment Variables (Project → Settings → Environment Variables):
   `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `NVIDIA_API_KEY`,
   `APP_PASSCODE` (optional), and any `*_MODELS` overrides.
4. Deploy. Open the URL. If `APP_PASSCODE` is set, you'll get the login screen.

Streaming works on the default Node.js runtime. `maxDuration` is set to 60s on
the chat route; on Hobby plans you can lower it if you hit limits.

### Deploy to Cloudflare (optional)

Cloudflare doesn't run Next.js natively; use the OpenNext adapter:

```bash
npm i -D @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare build
npx wrangler deploy
```

Set the same variables in the Worker's dashboard. Note: long-running streams
and request body size limits are stricter on Workers, so **Vercel is the
recommended target** for this app.

---

## How privacy mode works

- Normal mode: Auto route (OpenAI first). Messages/attachments are sent to
  whichever provider serves the request; your conversation is saved locally in
  the browser.
- Private mode: the model picker is locked to Gemini, so nothing goes to
  OpenAI/Groq/NVIDIA. The chat is **not** written to IndexedDB. Toggling a
  saved chat to private deletes its stored copy.

This matches your requirement: OpenAI may train on data, so private/temporary
chats go only to your paid Gemini key.

---

## Project structure

```
app/
  api/auth/route.ts     passcode login/logout (sets httpOnly cookie)
  api/chat/route.ts     streaming chat with provider fallback (SSE)
  api/models/route.ts   serves agent + model metadata to the UI
  login/page.tsx        passcode screen
  page.tsx              chat app
  globals.css           theme + markdown/print styles
components/
  ChatApp.tsx           main state, streaming, routing UI, theme, export/import
  Sidebar.tsx           conversation list + import/export buttons
  AgentPicker.tsx       agent dropdown (searchable, switchable mid-chat)
  ModelPicker.tsx       model dropdown + auto route
  Composer.tsx          textarea, attachments, drag/drop, paste, voice input
  MessageBubble.tsx     messages with markdown + retry/copy/listen + stats
  PrintModal.tsx        print/PDF preview with hide-answers toggle
  Markdown.tsx          react-markdown + KaTeX + code copy
lib/
  agents.ts             all agents & system prompts
  models.ts             model registry, env parsing, fallback builder
  providers.ts          OpenAI-compatible + Gemini streaming adapters (usage stats)
  files.ts              client-side file → attachment conversion
  storage.ts            IndexedDB conversation storage
  exchange.ts           chat export / import (.json)
  auth.ts               passcode hashing/validation
middleware.ts           passcode gate
```

---

## Adding your own agent

Edit `lib/agents.ts` and add an object to the `AGENTS` array:

```ts
{
  id: "myagent",
  name: "MyAgent",
  emoji: "🚀",
  tagline: "Short line for the picker",
  description: "Longer description on the empty state.",
  color: "#6366f1",
  category: "Work",          // Kids | Learning | Work | Health | Life | Create
  prefer: "gemini:gemini-flash-latest", // optional preferred model
  needsVision: true,          // optional: hints image-capable routing
  systemPrompt: withRules(`Your instructions here.`),
  starters: ["Example prompt 1", "Example prompt 2"],
}
```

The UI picks it up automatically via `/api/models`.

---

## Voice & image compression

- **Mic input**: tap the microphone in the composer. Works in Chrome, Edge and
  Safari (Web Speech API). Interim words appear in a small bubble while you
  speak; finalized text is appended to the message.
- **Read aloud**: use **Listen** on any assistant message, or turn on the
  header **Read** toggle to auto-read every new reply. Markdown, code and math
  are stripped so only the prose is spoken. KidStory uses a slower rate and a
  slightly higher pitch for children.
- **Image compression**: every image is resized and re-encoded client-side
  (target ~1.1 MB each) before sending. A 12 MP phone photo typically lands
  around 200–600 KB, so you can attach several per message.
- Requires a browser with Web Speech support; the buttons hide automatically
  where unsupported.

## Cost & safety notes

- Attachments are sent inline (base64) to the provider, so the app caps each
  file at 3 MB and the total per message at 3 MB (Vercel limits function
  request bodies to 4.5 MB).
- To allow larger files, self-host (e.g. Docker / a VPS) where no 4.5 MB limit
  applies, and raise the constants in `lib/files.ts`.
- Doctor / Psycho / LegalLite / Finance agents include explicit "not
  professional advice" guardrails, but always use your own judgement.
- History is per-browser. Clearing site data removes it permanently.
