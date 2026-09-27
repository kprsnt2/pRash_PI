"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2, Sparkles } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Login failed");
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-3xl border border-[#26304a] bg-[#111726] p-7 shadow-2xl shadow-black/40 fade-up"
    >
      <div className="mb-5 flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-500/20 text-indigo-300">
          <Sparkles size={19} />
        </span>
        <div>
          <div className="font-semibold">pRash AI</div>
          <div className="text-xs text-[#6b7899]">Private access</div>
        </div>
      </div>

      <label className="mb-1.5 block text-xs font-medium text-[#93a0bd]">
        Passcode
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-[#26304a] bg-[#0d1322] px-3">
        <Lock size={15} className="text-[#6b7899]" />
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoFocus
          placeholder="Enter passcode"
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-[#6b7899]"
        />
      </div>

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

      <button
        type="submit"
        disabled={busy || !passcode}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:bg-[#26304a] disabled:text-[#6b7899]"
      >
        {busy && <Loader2 size={15} className="animate-spin" />}
        Enter
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid h-dvh place-items-center px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
