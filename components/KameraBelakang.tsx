"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Kamera belakang untuk foto absensi.
 *
 * Jalur utama memakai aliran kamera langsung supaya mandor tidak bisa
 * memilih foto lama dari galeri. Kalau browser menolak (beberapa HP dan
 * iOS lama), dipakai jalur cadangan: tombol kamera bawaan sistem.
 */
export default function KameraBelakang({
  terbuka,
  judul,
  onFoto,
  onBatal,
}: {
  terbuka: boolean;
  judul: string;
  onFoto: (file: File) => void;
  onBatal: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const aliran = useRef<MediaStream | null>(null);
  const cadangan = useRef<HTMLInputElement>(null);
  const [siap, setSiap] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);

  useEffect(() => {
    if (!terbuka) return;
    let batal = false;

    (async () => {
      setGagal(null);
      setSiap(false);
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (batal) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        aliran.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play();
        }
        setSiap(true);
      } catch {
        setGagal("Kamera tidak bisa dibuka langsung. Pakai tombol di bawah.");
      }
    })();

    return () => {
      batal = true;
      aliran.current?.getTracks().forEach((t) => t.stop());
      aliran.current = null;
    };
  }, [terbuka]);

  function ambil() {
    const v = video.current;
    if (!v) return;
    const kanvas = document.createElement("canvas");
    kanvas.width = v.videoWidth;
    kanvas.height = v.videoHeight;
    kanvas.getContext("2d")?.drawImage(v, 0, 0);
    kanvas.toBlob(
      (b) => {
        if (!b) return;
        onFoto(new File([b], "absen.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }

  if (!terbuka) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-allegro-800">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-semibold text-white">{judul}</p>
        <button className="btn-ringan" onClick={onBatal}>
          Batal
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        {!siap && !gagal && (
          <p className="absolute inset-0 grid place-items-center text-sm text-white">
            Menyalakan kamera…
          </p>
        )}
        {gagal && (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white">
            {gagal}
          </p>
        )}
      </div>

      <div className="space-y-3 px-4 pb-8 pt-4">
        {siap && (
          <button className="btn-lapangan" onClick={ambil}>
            Ambil foto
          </button>
        )}

        <input
          ref={cadangan}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFoto(f);
            e.target.value = "";
          }}
        />
        <button
          className={siap ? "btn-ringan w-full" : "btn-lapangan"}
          onClick={() => cadangan.current?.click()}
        >
          Pakai kamera bawaan HP
        </button>
      </div>
    </div>
  );
}
