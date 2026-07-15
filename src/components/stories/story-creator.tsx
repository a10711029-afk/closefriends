"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { CustomCamera } from "@/components/chat/custom-camera";
import { useSession } from "@/hooks/use-session";

interface StoryCreatorProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function StoryCreator({ onClose, onSuccess }: StoryCreatorProps) {
  const { user, supabase } = useSession();
  const [showCamera, setShowCamera] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function prepareImage(file: File) {
    setUploading(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.84,
      });
      setImageFile(compressed);
      setPreview(URL.createObjectURL(compressed));
      setShowCamera(false);
    } catch {
      toast.error("Não foi possível preparar a fotografia.");
    } finally {
      setUploading(false);
    }
  }

  const handleCameraCapture = (file: File) => {
    void prepareImage(file);
  };

  const handleSend = async () => {
    if (!imageFile || !user) return;
    
    setUploading(true);
    try {
      const storyId = crypto.randomUUID();
      const path = `${user.id}/${storyId}.webp`;
      
      const { error: uploadError } = await supabase.storage
        .from("stories")
        .upload(path, imageFile, { contentType: imageFile.type || "image/webp", upsert: false });
      
      if (uploadError) {
        toast.error("O upload falhou. Tenta novamente.");
        throw uploadError;
      }
      
      const { error } = await supabase
        .from("stories")
        .insert({
          id: storyId,
          user_id: user.id,
          image_url: path,
          caption: caption.trim() || null,
        });
      
      if (error) {
        await supabase.storage.from("stories").remove([path]);
        toast.error("Story não enviado.");
        throw error;
      }
      
      toast.success("Story enviado com sucesso!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error sending story:", error);
    } finally {
      setUploading(false);
    }
  };

  if (showCamera) {
    return <CustomCamera onCapture={handleCameraCapture} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative mx-auto max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[380px] overflow-y-auto rounded-[28px] bg-[var(--surface)] p-6 shadow-2xl no-scrollbar">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-[var(--surface-2)] press"
        >
          <X size={16} />
        </button>

        <h3 className="text-lg font-bold mb-4 text-center">Criar Story</h3>

        {uploading && !preview ? (
          <div className="grid aspect-[9/13] place-items-center rounded-2xl bg-[var(--surface-2)]">
            <div className="text-center"><LoaderCircle className="mx-auto animate-spin text-[var(--brand)]" /><p className="mt-3 text-sm muted">A preparar fotografia…</p></div>
          </div>
        ) : !preview ? (
          <div className="flex aspect-[9/13] w-full flex-col items-center justify-center rounded-2xl bg-[var(--surface-2)] p-6 text-center">
            <div className="grid size-16 place-items-center rounded-full bg-[var(--surface)] text-[var(--brand)] shadow-sm"><Camera size={30} /></div>
            <p className="mt-4 font-semibold">Partilha um momento</p>
            <p className="mt-1 text-sm muted">Usa a câmara ou escolhe uma fotografia.</p>
            <div className="mt-6 grid w-full grid-cols-2 gap-3">
              <button onClick={() => setShowCamera(true)} className="press flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] py-3 text-sm font-semibold text-white"><Camera size={18} />Câmara</button>
              <button onClick={() => galleryRef.current?.click()} className="press flex items-center justify-center gap-2 rounded-2xl bg-[var(--surface)] py-3 text-sm font-semibold"><ImagePlus size={18} />Galeria</button>
            </div>
            <input ref={galleryRef} hidden type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void prepareImage(file); }} />
          </div>
        ) : (
          <>
            <div className="aspect-[9/16] rounded-2xl overflow-hidden mb-4">
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            </div>
            
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escreve uma legenda..."
              maxLength={500}
              className="w-full min-h-[80px] rounded-xl bg-[var(--surface-2)] p-3 text-sm resize-none mb-4"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setImageFile(null);
                  setPreview(null);
                  setCaption("");
                }}
                className="flex-1 rounded-xl bg-[var(--surface-2)] py-3 font-semibold press"
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={uploading}
                className="flex-1 rounded-xl bg-[var(--brand)] py-3 font-semibold text-white press disabled:opacity-50"
              >
                {uploading ? (
                  <LoaderCircle size={18} className="mx-auto animate-spin" />
                ) : (
                  "Enviar"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
