"use client";
import { useRef, useState, useEffect } from "react";
import { Mic, Send, X, LoaderCircle } from "lucide-react";

interface VoiceRecorderProps {
  onSend: (audioFile: File) => Promise<void>;
}

export function VoiceRecorder({ onSend }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setDuration(0);
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
      const file = new File([audioBlob], "voice-message.webm", { type: "audio/webm" });
      await onSend(file);
      setAudioBlob(null);
      setDuration(0);
    } catch (error) {
      console.error("Error sending voice message:", error);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  if (!isRecording && !audioBlob) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] rounded-full">
      {isRecording ? (
        <>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium">{formatDuration(duration)}</span>
          </div>
          <button
            onClick={cancelRecording}
            className="press grid size-8 place-items-center rounded-full bg-red-500 text-white"
          >
            <X size={16} />
          </button>
          <button
            onClick={stopRecording}
            className="press grid size-8 place-items-center rounded-full bg-[var(--brand)] text-white"
          >
            <Mic size={16} />
          </button>
        </>
      ) : (
        <>
          {audioBlob && (
            <audio 
              src={URL.createObjectURL(audioBlob)} 
              controls 
              className="h-8"
            />
          )}
          <span className="text-sm muted">{formatDuration(duration)}</span>
          <button
            onClick={cancelRecording}
            className="press grid size-8 place-items-center rounded-full hover:bg-[var(--surface)] transition-colors"
          >
            <X size={16} />
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="press grid size-8 place-items-center rounded-full bg-[var(--brand)] text-white disabled:opacity-50"
          >
            {isSending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </>
      )}
    </div>
  );
}
