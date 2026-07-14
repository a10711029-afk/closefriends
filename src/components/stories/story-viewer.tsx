"use client";
import { useState, useEffect } from "react";
import { X, Send, LoaderCircle } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

interface Story {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  user?: {
    id?: string;
    username?: string;
    display_name?: string;
    avatar_url?: string | null;
  };
  signed_image_url?: string | null;
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  onClose: () => void;
}

export function StoryViewer({ stories, initialIndex, onClose }: StoryViewerProps) {
  const { supabase } = useSession();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const currentStory = stories[currentIndex];

  useEffect(() => {
    loadSignedUrls();
  }, [stories, supabase]);

  async function loadSignedUrls() {
    const urls: Record<string, string> = {};
    
    for (const story of stories) {
      if (story.image_url && !urls[story.id]) {
        const { data } = await supabase.storage
          .from("stories")
          .createSignedUrl(story.image_url, 3600);
        urls[story.id] = data?.signedUrl || "";
      }
    }
    
    setSignedUrls(urls);
    setLoading(false);
  }

  useEffect(() => {
    if (loading) return;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          goToNext();
          return 0;
        }
        return prev + 1;
      });
    }, 50); // 5 seconds total (100 * 50ms)

    return () => clearInterval(timer);
  }, [currentIndex, loading]);

  function goToNext() {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }

  function goToPrevious() {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  }

  if (loading || !currentStory) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <LoaderCircle className="animate-spin text-white" size={40} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="safe-top absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img
              src={currentStory.user?.avatar_url || "/placeholder-avatar.png"}
              alt={currentStory.user?.display_name}
              className="size-10 rounded-full object-cover"
            />
            <div>
              <p className="text-white font-semibold text-sm">
                {currentStory.user?.display_name || currentStory.user?.username}
              </p>
              <p className="text-white/60 text-xs">
                {new Date(currentStory.created_at).toLocaleString("pt-PT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-white/20 backdrop-blur-md text-white press"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress indicators */}
        <div className="flex gap-1">
          {stories.map((_, index) => (
            <div
              key={index}
              className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-50"
                style={{
                  width: index < currentIndex ? "100%" : index === currentIndex ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Story Content */}
      <div className="h-full flex items-center justify-center">
        <img
          src={signedUrls[currentStory.id] || currentStory.image_url}
          alt="Story"
          className="max-h-full max-w-full object-contain"
          onClick={goToNext}
        />
      </div>

      {/* Caption */}
      {currentStory.caption && (
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-[max(24px,env(safe-area-inset-bottom))]">
          <p className="text-white text-sm bg-black/30 backdrop-blur-md rounded-lg p-3">
            {currentStory.caption}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="absolute inset-0 flex">
        <button
          onClick={goToPrevious}
          className="flex-1"
          disabled={currentIndex === 0}
        />
        <button
          onClick={goToNext}
          className="flex-1"
          disabled={currentIndex === stories.length - 1}
        />
      </div>
    </div>
  );
}
