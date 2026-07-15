"use client";
import { useState, useRef } from "react";
import { Camera, X, Send, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
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

  const handleCameraCapture = (file: File) => {
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
    setShowCamera(false);
  };

  const handleSend = async () => {
    if (!imageFile || !user) return;
    
    setUploading(true);
    try {
      const storyId = crypto.randomUUID();
      const path = `${user.id}/${storyId}.webp`;
      
      const { error: uploadError } = await supabase.storage
        .from("stories")
        .upload(path, imageFile, { contentType: "image/webp", upsert: false });
      
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
      <div className="mx-auto w-full max-w-[340px] rounded-[28px] bg-[var(--surface)] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-[var(--surface-2)] press"
        >
          <X size={16} />
        </button>

        <h3 className="text-lg font-bold mb-4 text-center">Criar Story</h3>

        {!preview ? (
          <button
            onClick={() => setShowCamera(true)}
            className="w-full aspect-[9/16] rounded-2xl bg-[var(--surface-2)] flex flex-col items-center justify-center gap-3 press hover:bg-[var(--surface-2)]/80 transition-colors"
          >
            <Camera size={48} className="text-[var(--brand)]" />
            <span className="text-sm font-medium">Tirar fotografia</span>
          </button>
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
