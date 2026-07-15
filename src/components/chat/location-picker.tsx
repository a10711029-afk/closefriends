"use client";
import { useState, useEffect } from "react";
import { MapPin, X, LoaderCircle, RefreshCw } from "lucide-react";

type SharedLocation = { lat: number; lng: number; address?: string; accuracy?: number };

interface LocationPickerProps {
  onSend: (location: SharedLocation) => void;
  onClose: () => void;
}

export function LocationPicker({ onSend, onClose }: LocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<SharedLocation | null>(null);

  const getCurrentLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocalização não suportada pelo navegador");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        // Try to get address using reverse geocoding (using OpenStreetMap Nominatim)
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          
          setLocation({
            lat: latitude,
            lng: longitude,
            address: data.display_name || undefined,
            accuracy,
          });
        } catch {
          setLocation({
            lat: latitude,
            lng: longitude,
            accuracy,
          });
        }
        
        setLoading(false);
      },
      (err) => {
        const message = err.code === err.PERMISSION_DENIED
          ? "A localização está bloqueada. Ativa a permissão nas definições do Safari."
          : "Não foi possível obter a localização. Tenta novamente num local com melhor sinal.";
        setError(message);
        setLoading(false);
      },
      {
<<<<<<< HEAD
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
=======
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 30000,
>>>>>>> a7427ac59fd52b756eb16471061647561cd4b01c
      }
    );
  };

  useEffect(() => {
    const timer = window.setTimeout(getCurrentLocation, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="text-center text-white">
          <LoaderCircle size={40} className="mx-auto animate-spin mb-4" />
          <p>A obter localização...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="relative mx-auto w-[calc(100%-24px)] max-w-[360px] rounded-[28px] bg-[var(--surface)] p-6 shadow-2xl">
          <div className="text-center">
            <MapPin size={40} className="mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-bold mb-2">Erro</h3>
            <p className="text-sm muted mb-6">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={getCurrentLocation}
                className="flex-1 rounded-xl bg-[var(--brand)] py-3 font-semibold text-white press"
              >
                Tentar novamente
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-[var(--surface-2)] py-3 font-semibold press"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative mx-auto w-[calc(100%-24px)] max-w-[360px] rounded-[28px] bg-[var(--surface)] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-[var(--surface-2)] press"
        >
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <MapPin size={48} className="mx-auto text-[var(--brand)] mb-4" />
          <h3 className="text-lg font-bold mb-2">Partilhar Localização</h3>
          {location?.address && (
            <p className="text-sm muted line-clamp-2">{location.address}</p>
          )}
          {location?.accuracy && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs muted">
              <span>Precisão aproximada: {Math.round(location.accuracy)} m</span>
              <button onClick={getCurrentLocation} className="press inline-flex items-center gap-1 font-semibold text-[var(--brand)]">
                <RefreshCw size={12} /> Atualizar
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => location && onSend(location)}
            disabled={!location}
            className="flex-1 rounded-xl bg-[var(--brand)] py-3 font-semibold text-white press disabled:opacity-50"
          >
            Partilhar
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-[var(--surface-2)] py-3 font-semibold press"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
