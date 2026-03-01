"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface VoiceButtonProps {
  clinicId: string;
  doctorId: string;
  userId: string;
}

type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "error";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
const SEND_SAMPLE_RATE = 16000;
const RECEIVE_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;
const SESSION_LIMIT_MS = 60 * 60 * 1000; // 1 hour — auto-disconnect if session runs this long

export default function VoiceButton({ clinicId, doctorId, userId }: VoiceButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [agentText, setAgentText] = useState("");
  const [expanded, setExpanded] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const sessionId = useRef(`session-${Date.now()}`);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // true when the user explicitly stopped the session (button tap / 1hr limit)
  const userStoppedRef = useRef(false);

  const stateRef = useRef<VoiceState>("idle");
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Audio helpers ────────────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
    }
    audioContextRef.current = null;
  }, []);

  // ── Main session ─────────────────────────────────────────────────────────
  const playAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    setState("speaking");

    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!;
      const ctx = new AudioContext({ sampleRate: RECEIVE_SAMPLE_RATE });
      const buffer = ctx.createBuffer(1, chunk.byteLength / 2, RECEIVE_SAMPLE_RATE);
      const channelData = buffer.getChannelData(0);
      const int16 = new Int16Array(chunk);
      for (let i = 0; i < int16.length; i++) {
        channelData[i] = int16[i] / 32768;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      await new Promise<void>((resolve) => {
        source.onended = () => { ctx.close(); resolve(); };
        source.start();
      });
    }

    isPlayingRef.current = false;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setState("listening");
    }
  }, []);

  const disconnect = useCallback((userInitiated = true) => {
    userStoppedRef.current = userInitiated;
    if (sessionTimerRef.current) { clearTimeout(sessionTimerRef.current); sessionTimerRef.current = null; }
    stopAudio();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    if (userInitiated) setState("idle");
  }, [stopAudio]);

  const connect = useCallback(async () => {
    if (stateRef.current !== "idle") {
      disconnect(true);
      return;
    }

    setState("connecting");
    setTranscript("");
    setAgentText("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const url = `${WS_URL}/ws/voice/${userId}/${sessionId.current}?clinic_id=${clinicId}&doctor_id=${doctorId}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setState("listening");

        const audioCtx = new AudioContext({ sampleRate: SEND_SAMPLE_RATE });
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
          }
          ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          const parts = data?.serverContent?.modelTurn?.parts ?? [];
          for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith("audio/")) {
              const raw = atob(part.inlineData.data);
              const buf = new ArrayBuffer(raw.length);
              const view = new Uint8Array(buf);
              for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
              audioQueueRef.current.push(buf);
            }
            if (part.text) setAgentText((prev) => prev + part.text);
          }

          const inputT = data?.serverContent?.inputTranscription?.text;
          if (inputT) setTranscript((prev) => prev + " " + inputT);

          const outputT = data?.serverContent?.outputTranscription?.text;
          if (outputT) setAgentText((prev) => prev + " " + outputT);

          if (audioQueueRef.current.length > 0) playAudioQueue();
        } catch { /* non-JSON frames ignored */ }
      };

      ws.onerror = () => { /* close will fire next, handled there */ };
      ws.onclose = () => {
        stopAudio();
        if (userStoppedRef.current) {
          // User tapped stop or 1-hr limit hit — stay idle
          setState("idle");
        } else {
          // Gemini expired the session (~15 min) — reconnect silently
          setState("connecting");
          setTimeout(() => connectRef.current(), 500);
        }
      };

      // 1-hour safety cut-off — after this we stop reconnecting
      sessionTimerRef.current = setTimeout(() => disconnect(true), SESSION_LIMIT_MS);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
    userStoppedRef.current = false;
  }, [userId, clinicId, doctorId, disconnect, stopAudio, playAudioQueue]);

  const connectRef = useRef<() => void>(() => {});
  useEffect(() => { connectRef.current = connect; }, [connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (wsRef.current) wsRef.current.close();
      stopAudio();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── UI ───────────────────────────────────────────────────────────────────
  const STATE_COLORS: Record<VoiceState, string> = {
    idle: "bg-primary hover:bg-primary/90",
    connecting: "bg-yellow-500 animate-pulse",
    listening: "bg-red-500 animate-pulse",
    speaking: "bg-green-500",
    error: "bg-destructive",
  };

  const STATE_ICONS: Record<VoiceState, React.ReactNode> = {
    idle: <Mic className="h-5 w-5" />,
    connecting: <Loader2 className="h-5 w-5 animate-spin" />,
    listening: <Mic className="h-5 w-5" />,
    speaking: <Volume2 className="h-5 w-5" />,
    error: <MicOff className="h-5 w-5" />,
  };

  const STATE_LABELS: Record<VoiceState, string> = {
    idle: "Tap to start Dia",
    connecting: "Connecting\u2026",
    listening: "Listening\u2026",
    speaking: "Dia is speaking\u2026",
    error: "Error \u2014 tap to retry",
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Transcript panel */}
      {expanded && (state === "listening" || state === "speaking") && (
        <div className="w-80 rounded-xl border bg-white p-4 shadow-xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">You</p>
          <p className="min-h-[20px] text-sm text-gray-700">{transcript || "\u2026"}</p>
          <hr className="my-2" />
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dia</p>
          <p className="min-h-[20px] text-sm text-gray-700">{agentText || "\u2026"}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* State label */}
        {state !== "idle" && (
          <span
            className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-medium shadow ring-1 ring-black/5"
            onClick={() => setExpanded((v) => !v)}
          >
            {STATE_LABELS[state]}
          </span>
        )}

        {/* Main mic button — tap to start, tap again to stop */}
        <button
          onClick={connect}
          title={STATE_LABELS[state]}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all",
            STATE_COLORS[state]
          )}
        >
          {STATE_ICONS[state]}
        </button>
      </div>
    </div>
  );
}
