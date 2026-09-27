"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: RecognitionResultLike;
  };
}

interface RecognitionErrorLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  }
}

function getCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

export function isSpeechRecognitionSupported(): boolean {
  return !!getCtor();
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
  onFinal?: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  onError?: (message: string) => void;
}

export function useSpeechRecognition(opts: UseSpeechRecognitionOptions = {}) {
  const { lang = "en-IN" } = opts;
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
    return () => {
      wantRef.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const ensure = useCallback((): SpeechRecognitionLike | null => {
    const Ctor = getCtor();
    if (!Ctor) return null;
    if (recRef.current) return recRef.current;

    const rec = new Ctor();
    rec.lang = optsRef.current.lang ?? lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) optsRef.current.onFinal?.(text.trim());
        else interim += text;
      }
      if (interim) optsRef.current.onInterim?.(interim.trim());
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRef.current = false;
        optsRef.current.onError?.(
          "Microphone permission denied. Allow mic access in your browser.",
        );
      } else if (e.error === "no-speech") {
        // ignore; the onend handler will restart if still wanted
      } else if (e.error !== "aborted") {
        optsRef.current.onError?.(`Speech error: ${e.error}`);
      }
    };

    rec.onend = () => {
      // Browsers stop recognition periodically; restart while the user wants it.
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setListening(false);
    };

    recRef.current = rec;
    return rec;
  }, [lang]);

  const start = useCallback(() => {
    const rec = ensure();
    if (!rec) {
      optsRef.current.onError?.("Speech recognition is not supported here.");
      return;
    }
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() throws if already started
      setListening(true);
    }
  }, [ensure]);

  const stop = useCallback(() => {
    wantRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { listening, supported, start, stop, toggle };
}
