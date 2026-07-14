"use client";
import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
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
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface StoriesBarProps {
  onStoryClick?: (story: Story) => void;
  onCreateStory?: () => void;
}

export function StoriesBar({ onStoryClick, onCreateStory }: StoriesBarProps) {
  const { user, supabase } = useSession();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStories();
  }, [user, supabase]);

  async function loadStories() {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("stories")
      .select(`
        *,
        user:profiles!user_id(id, username, display_name, avatar_url)
      `)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Não foi possível carregar stories.");
    } else {
      setStories(data || []);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex gap-3 px-4 py-3 overflow-x-auto no-scrollbar">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex-shrink-0">
            <div className="size-16 rounded-full bg-[var(--surface-2)] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-3 overflow-x-auto no-scrollbar border-b hairline">
      {/* Create Story Button */}
      <button
        onClick={onCreateStory}
        className="flex-shrink-0 flex flex-col items-center gap-1 press"
      >
        <div className="size-16 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)] p-0.5">
          <div className="size-full rounded-full bg-[var(--surface)] flex items-center justify-center">
            <Plus size={20} className="text-[var(--brand)]" />
          </div>
        </div>
        <span className="text-xs">Criar</span>
      </button>

      {/* Stories */}
      {stories.map((story) => (
        <button
          key={story.id}
          onClick={() => onStoryClick?.(story)}
          className="flex-shrink-0 flex flex-col items-center gap-1 press"
        >
          <div className="size-16 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)] p-0.5">
            <img
              src={story.user?.avatar_url || "/placeholder-avatar.png"}
              alt={story.user?.display_name || "Story"}
              className="size-full rounded-full object-cover"
            />
          </div>
          <span className="text-xs truncate max-w-[60px]">
            {story.user?.display_name || story.user?.username}
          </span>
        </button>
      ))}
    </div>
  );
}
