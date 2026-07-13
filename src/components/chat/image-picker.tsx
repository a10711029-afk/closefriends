"use client";
import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Camera, ImagePlus, LoaderCircle, Send, X } from "lucide-react";
import { toast } from "sonner";

export function ImagePicker({ onSend }: { onSend: (file: File, caption: string) => Promise<void> }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [fromCamera, setFromCamera] = useState(false);

  async function choose(list: FileList | null, isCamera: boolean) {
    const raw = list?.[0];
    if (!raw) return;
    try {
      setBusy(true);
      setFromCamera(isCamera);
      const compressed = await imageCompression(raw, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.85,
      });
      setFile(compressed);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      toast.error("Não foi possível preparar a fotografia.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!file) return;
    setBusy(true);
    try {
      await onSend(file, caption);
      setFile(null);
      setPreview(null);
      setCaption("");
      setFromCamera(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex gap-1">
        <button
          onClick={() => camera.current?.click()}
          aria-label="Câmara"
          className="press grid size-10 place-items-center rounded-full text-[var(--brand)]"
        >
          <Camera size={22} />
        </button>
        <button
          onClick={() => gallery.current?.click()}
          aria-label="Galeria"
          className="press grid size-10 place-items-center rounded-full text-[var(--brand)]"
        >
          <ImagePlus size={22} />
        </button>
      </div>
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => choose(e.target.files, true)}
      />
      <input
        ref={gallery}
        hidden
        type="file"
        accept="image/*"
        onChange={(e) => choose(e.target.files, false)}
      />
      {(preview || busy) && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm">
          <div className="mx-auto w-full max-w-[420px] rounded-[30px] bg-[var(--surface)] p-4 fade-up">
            {preview ? (
              <>
                <div className="relative overflow-hidden rounded-[22px] bg-black">
                  <img
                    src={preview}
                    alt="Pré-visualização"
                    className="max-h-[58dvh] w-full object-contain"
                  />
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      setFromCamera(false);
                    }}
                    className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/50 text-white press"
                  >
                    <X size={18} />
                  </button>
                </div>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Legenda (opcional)…"
                  className="mt-3 w-full resize-none rounded-xl bg-[var(--surface-2)] p-3 text-sm"
                  rows={2}
                />
                <button
                  onClick={send}
                  disabled={busy}
                  className="mt-3 w-full rounded-xl bg-[var(--brand)] py-3 font-semibold text-white press disabled:opacity-50"
                >
                  {busy ? <LoaderCircle size={20} className="mx-auto animate-spin" /> : "Enviar"}
                </button>
              </>
            ) : (
              <div className="grid h-32 place-items-center">
                <LoaderCircle size={32} className="animate-spin text-[var(--brand)]" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
