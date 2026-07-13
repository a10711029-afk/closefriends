"use client";
import { useRef, useState, useEffect } from "react";
import { Camera, FlashlightOff, Flashlight, X, RotateCw } from "lucide-react";

export function CustomCamera({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [flash, setFlash] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  async function startCamera() {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setLoading(false);
    } catch (error) {
      console.error("Camera error:", error);
      setLoading(false);
    }
  }

  function toggleCamera() {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  }

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    if (facingMode === "user") {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
        onCapture(file);
      }
    }, "image/jpeg", 0.9);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
        <button onClick={onClose} className="grid size-10 place-items-center rounded-full bg-black/30 text-white press">
          <X size={24} />
        </button>
        <button onClick={() => setFlash(!flash)} className="grid size-10 place-items-center rounded-full bg-black/30 text-white press">
          {flash ? <Flashlight size={24} /> : <FlashlightOff size={24} />}
        </button>
      </div>

      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-sm">A carregar câmara...</div>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-center gap-8">
          <button onClick={toggleCamera} className="grid size-12 place-items-center rounded-full bg-black/30 text-white press">
            <RotateCw size={24} />
          </button>
          <button
            onClick={capture}
            className="grid size-20 place-items-center rounded-full border-4 border-white press active:scale-95 transition-transform"
          >
            <div className="size-16 rounded-full bg-white" />
          </button>
          <div className="size-12" />
        </div>
      </div>
    </div>
  );
}
