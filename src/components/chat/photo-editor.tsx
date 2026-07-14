"use client";
import { useRef, useState, useEffect } from "react";
import { X, Palette, Type, Eraser, Download } from "lucide-react";

interface PhotoEditorProps {
  imageSrc: string;
  onSave: (editedImage: File) => void;
  onClose: () => void;
}

export function PhotoEditor({ imageSrc, onSave, onClose }: PhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"brush" | "text" | "eraser">("brush");
  const [color, setColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(3);
  const [text, setText] = useState("");
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [showTextInput, setShowTextInput] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "text") {
      const coords = getCoordinates(e);
      setTextPosition(coords);
      setShowTextInput(true);
      return;
    }

    setIsDrawing(true);
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool === "text") return;

    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = tool === "eraser" ? "rgba(0,0,0,1)" : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      ctx.globalCompositeOperation = "source-over";
    }
  };

  const addText = () => {
    if (!text.trim()) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.font = `${brushSize * 10}px Arial`;
    ctx.fillStyle = color;
    ctx.fillText(text, textPosition.x, textPosition.y);
    setText("");
    setShowTextInput(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "edited-photo.webp", { type: "image/webp" });
        onSave(file);
      }
    }, "image/webp", 0.92);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = imageSrc;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl p-4">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-white/20 backdrop-blur-md text-white press"
        >
          <X size={20} />
        </button>

        <div className="relative rounded-2xl overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="w-full h-auto cursor-crosshair"
            style={{ touchAction: "none" }}
          />

          {showTextInput && (
            <div
              className="absolute bg-white/90 backdrop-blur-md rounded-lg p-2 shadow-lg"
              style={{
                left: textPosition.x / (canvasRef.current?.width || 1) * 100 + "%",
                top: textPosition.y / (canvasRef.current?.height || 1) * 100 + "%",
              }}
            >
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addText();
                  if (e.key === "Escape") {
                    setShowTextInput(false);
                    setText("");
                  }
                }}
                placeholder="Escreve..."
                className="bg-transparent text-black px-2 py-1 text-sm outline-none"
                autoFocus
              />
              <button
                onClick={addText}
                className="ml-2 text-sm font-medium text-[var(--brand)]"
              >
                OK
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setTool("brush")}
            className={`grid size-10 place-items-center rounded-full press transition-colors ${
              tool === "brush" ? "bg-[var(--brand)] text-white" : "bg-white/20 text-white"
            }`}
          >
            <Palette size={18} />
          </button>

          <button
            onClick={() => setTool("text")}
            className={`grid size-10 place-items-center rounded-full press transition-colors ${
              tool === "text" ? "bg-[var(--brand)] text-white" : "bg-white/20 text-white"
            }`}
          >
            <Type size={18} />
          </button>

          <button
            onClick={() => setTool("eraser")}
            className={`grid size-10 place-items-center rounded-full press transition-colors ${
              tool === "eraser" ? "bg-[var(--brand)] text-white" : "bg-white/20 text-white"
            }`}
          >
            <Eraser size={18} />
          </button>

          <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-6 h-6 rounded-full cursor-pointer"
            />
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20"
            />
          </div>

          <button
            onClick={clearCanvas}
            className="px-4 py-2 rounded-full bg-white/20 text-white text-sm press hover:bg-white/30 transition-colors"
          >
            Limpar
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--brand)] text-white text-sm press hover:bg-[var(--brand)]/90 transition-colors"
          >
            <Download size={16} />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
