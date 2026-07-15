"use client";
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, CircleStop, Lock, Play, Send, Trash2, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

interface VoiceRecorderProps {
  onSend: (audioFile: File) => Promise<void>;
  onClose: () => void;
  gestureStart?: { x: number; y: number } | null;
}

const MIME_TYPES = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

function supportedMimeType() {
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export function VoiceRecorder({ onSend, onClose, gestureStart }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [gesture, setGesture] = useState<"cancel" | "lock" | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const discardRef = useRef(false);
  const recordingSessionRef = useRef(0);
  const lockedRef = useRef(false);
  const gestureRef = useRef<"cancel" | "lock" | null>(null);
  const pendingStopRef = useRef(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const startRecording = async (session: number) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("unsupported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (session !== recordingSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = supportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      streamRef.current = stream;
      chunksRef.current = [];
      discardRef.current = false;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || mimeType || "audio/mp4",
        });
        if (!discardRef.current && blob.size > 0) setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      if (pendingStopRef.current) {
        pendingStopRef.current = false;
        window.setTimeout(() => {
          if (mediaRecorder.state === "recording") mediaRecorder.stop();
          setIsRecording(false);
        }, 0);
      }

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Não foi possível usar o microfone. Verifica a permissão.");
      onClose();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    } else pendingStopRef.current = true;
  };

  const cancelRecording = () => {
    discardRef.current = true;
    stopRecording();
    setAudioBlob(null);
    setDuration(0);
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = async () => {
    if (!audioBlob) return;
    setIsSending(true);
    try {
      const extension = audioBlob.type.includes("mp4") ? "m4a" : audioBlob.type.includes("ogg") ? "ogg" : "webm";
      const file = new File([audioBlob], `voice-message.${extension}`, { type: audioBlob.type });
      await onSend(file);
      setAudioBlob(null);
      setDuration(0);
      onClose();
    } catch (error) {
      console.error("Error sending voice message:", error);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    const session = ++recordingSessionRef.current;
    void startRecording(session);
    
    return () => {
      recordingSessionRef.current += 1;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current?.state === "recording") {
        discardRef.current = true;
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!gestureStart) return;
    const move = (event: PointerEvent) => {
      const dx = event.clientX - gestureStart.x;
      const dy = event.clientY - gestureStart.y;
      const next = dx < -72 ? "cancel" : dy < -64 ? "lock" : null;
      gestureRef.current = next;
      setGesture(next);
      if (next === "lock") {
        lockedRef.current = true;
        setLocked(true);
      }
    };
    const release = () => {
      if (gestureRef.current === "cancel") cancelRecording();
      else if (!lockedRef.current) stopRecording();
      setGesture(null);
      gestureRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release, { once: true });
    window.addEventListener("pointercancel", release, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [gestureStart]);

  useEffect(() => {
    if (!audioBlob) {
      const timer = window.setTimeout(() => setPreviewUrl(null), 0);
      return () => window.clearTimeout(timer);
    }
    const url = URL.createObjectURL(audioBlob);
    const timer = window.setTimeout(() => setPreviewUrl(url), 0);
    return () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
    };
  }, [audioBlob]);

  if (!isRecording && !audioBlob) {
    return null;
  }

  return (
    <div className="safe-bottom border-t hairline bg-[var(--surface)] px-3 pt-3">
      <div className="mx-auto flex min-h-14 items-center gap-3 rounded-2xl bg-[var(--surface-2)] px-3">
      {isRecording ? (
        <>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium">{formatDuration(duration)}</span>
          </div>
          <div className="flex flex-1 items-center justify-center gap-2 text-xs font-medium muted">
            {locked ? (
              <><Lock size={14} className="text-[var(--brand)]" /> Gravação bloqueada</>
            ) : gesture === "cancel" ? (
              <span className="font-semibold text-red-500">Solta para cancelar</span>
            ) : gesture === "lock" ? (
              <span className="font-semibold text-[var(--brand)]">Solta para bloquear</span>
            ) : (
              <><ChevronLeft size={16} /> Desliza para cancelar · sobe para bloquear</>
            )}
          </div>
          <button onClick={cancelRecording} aria-label="Eliminar gravação" className="press grid size-10 place-items-center rounded-full text-red-500">
            <Trash2 size={19} />
          </button>
          <button
            onClick={stopRecording}
            aria-label="Parar gravação"
            className="press grid size-10 place-items-center rounded-full bg-red-500 text-white"
          >
            <CircleStop size={19} />
          </button>
        </>
      ) : (
        <>
          <Play size={18} className="text-[var(--brand)]" />
          {previewUrl && <audio src={previewUrl} controls preload="metadata" className="h-9 min-w-0 flex-1" />}
          <span className="text-sm muted">{formatDuration(duration)}</span>
          <button
            onClick={cancelRecording}
            aria-label="Eliminar gravação"
            className="press grid size-10 place-items-center rounded-full text-red-500"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            aria-label="Enviar gravação"
            className="press grid size-10 place-items-center rounded-full bg-[var(--brand)] text-white disabled:opacity-50"
          >
            {isSending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </>
      )}
      </div>
    </div>
  );
}
