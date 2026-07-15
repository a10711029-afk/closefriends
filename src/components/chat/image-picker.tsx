"use client";
import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Camera, ImagePlus, LoaderCircle, MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { CustomCamera } from "./custom-camera";
import { PhotoEditor } from "./photo-editor";

export function ImagePicker({ onSend, onLocation }: { onSend: (file: File, caption: string, viewOnce?: boolean) => Promise<void>; onLocation: () => void }) {
  const gallery = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [fromCamera, setFromCamera] = useState(false);
  const [viewOnce, setViewOnce] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);

  async function handleCameraCapture(capturedFile: File) {
    setShowCamera(false);
    try {
      setBusy(true);
      setFromCamera(true);
      const compressed = await imageCompression(capturedFile, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.8,
      });
      setFile(compressed);
      setPreview(URL.createObjectURL(compressed));
      setShowEditor(true);
    } catch {
      toast.error("Não foi possível preparar a fotografia.");
    } finally {
      setBusy(false);
    }
  }

  function handleEditedImage(editedFile: File) {
    setFile(editedFile);
    setPreview(URL.createObjectURL(editedFile));
    setShowEditor(false);
  }

  async function choose(list: FileList | null) {
    const raw = list?.[0];
    if (!raw) return;
    try {
      setBusy(true);
      setFromCamera(false);
      const compressed = await imageCompression(raw, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.8,
      });
      setFile(compressed);
      setPreview(URL.createObjectURL(compressed));
      setShowEditor(true);
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
      await onSend(file, caption, fromCamera ? viewOnce : false);
      setFile(null);
      setPreview(null);
      setCaption("");
      setFromCamera(false);
      setViewOnce(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {showCamera && (
        <CustomCamera
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
      {showEditor && preview && (
        <PhotoEditor
          imageSrc={preview}
          onSave={handleEditedImage}
          onClose={() => setShowEditor(false)}
        />
      )}
      <button
        onClick={() => setShowAttachments(true)}
        aria-label="Adicionar anexo"
        className="press grid size-11 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--brand)]"
      >
        <Plus size={22} />
      </button>
      <input
        ref={gallery}
        hidden
        type="file"
        accept="image/*"
        onChange={(e) => choose(e.target.files)}
      />
      {(preview || busy) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200">
          <button
            onClick={() => {
              setFile(null);
              setPreview(null);
              setFromCamera(false);
            }}
            className="absolute right-4 top-[max(18px,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-white/20 backdrop-blur-md text-white press"
          >
            <X size={24} />
          </button>
          {preview ? (
            <div className="flex h-full w-full flex-col">
              <div className="flex-1 flex items-center justify-center p-4">
                <img
                  src={preview}
                  alt="Pré-visualização"
                  className="max-h-[60dvh] max-w-full object-contain animate-in zoom-in-95 duration-200"
                />
              </div>
              <div className="mx-auto w-full max-w-[420px] p-4 pb-[max(24px,env(safe-area-inset-bottom))]">
                {fromCamera && (
                  <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/10 backdrop-blur-md p-3">
                    <span className="text-sm text-white">Visualização única</span>
                    <button
                      onClick={() => setViewOnce(!viewOnce)}
                      className={`relative h-7 w-12 rounded-full transition-colors ${viewOnce ? "bg-[var(--brand)]" : "bg-white/30"}`}
                    >
                      <div
                        className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${viewOnce ? "translate-x-5" : "translate-x-1"}`}
                      />
                    </button>
                  </div>
                )}
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Legenda (opcional)…"
                  className="w-full resize-none rounded-2xl bg-white/10 backdrop-blur-md p-4 text-white placeholder-white/50 text-sm"
                  rows={2}
                />
                <button
                  onClick={send}
                  disabled={busy}
                  className="mt-3 w-full rounded-2xl bg-[var(--brand)] py-3.5 font-semibold text-white press disabled:opacity-50"
                >
                  {busy ? <LoaderCircle size={20} className="mx-auto animate-spin" /> : "Enviar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid h-32 place-items-center">
              <LoaderCircle size={32} className="animate-spin text-white" />
            </div>
          )}
        </div>
      )}
      {showAttachments && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm" onClick={() => setShowAttachments(false)}>
          <div className="mx-auto w-full max-w-[410px] rounded-[28px] bg-[var(--surface)] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <h2 className="font-bold">Adicionar à conversa</h2>
                <p className="mt-0.5 text-xs muted">Escolhe o que queres partilhar</p>
              </div>
              <button onClick={() => setShowAttachments(false)} aria-label="Fechar" className="grid size-9 place-items-center rounded-full bg-[var(--surface-2)]"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => { setShowAttachments(false); setShowCamera(true); }} className="press flex flex-col items-center gap-2 rounded-2xl bg-[var(--surface-2)] p-4 text-sm font-semibold">
                <span className="grid size-11 place-items-center rounded-full bg-[var(--brand)] text-white"><Camera size={21} /></span>
                Câmara
              </button>
              <button onClick={() => { setShowAttachments(false); gallery.current?.click(); }} className="press flex flex-col items-center gap-2 rounded-2xl bg-[var(--surface-2)] p-4 text-sm font-semibold">
                <span className="grid size-11 place-items-center rounded-full bg-[var(--brand-2)] text-white"><ImagePlus size={21} /></span>
                Galeria
              </button>
              <button onClick={() => { setShowAttachments(false); onLocation(); }} className="press flex flex-col items-center gap-2 rounded-2xl bg-[var(--surface-2)] p-4 text-sm font-semibold">
                <span className="grid size-11 place-items-center rounded-full bg-emerald-500 text-white"><MapPin size={21} /></span>
                Localização
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
