"use client";

import { useEffect, useRef, useState } from "react";
import { fotoMasihBaru, perangkatSeluler } from "@/lib/kamera";

/**
 * Kamera untuk foto absensi (swafoto maupun foto tim).
 *
 * Jalur utama memakai aliran kamera langsung di halaman, sehingga tidak ada
 * pilihan galeri sama sekali. Jalur cadangan "kamera bawaan HP" hanya muncul
 * bila kamera langsung gagal DAN perangkatnya HP. Di komputer jalur itu
 * membuka jendela pilih berkas, jadi tidak pernah ditampilkan. Foto dari
 * jalur cadangan juga ditolak bila bukan baru saja diambil.
 */
export default function KameraBelakang({
  terbuka,
  judul,
  arah = "belakang",
  onFoto,
  onBatal,
  memproses = false,
}: {
  terbuka: boolean;
  judul: string;
  /** Belakang untuk memotret orang lain, depan untuk swafoto sendiri. */
  arah?: "depan" | "belakang";
  onFoto: (file: File) => void;
  onBatal: () => void;
  /** Sedang mengunggah atau menyimpan ke server. */
  memproses?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const aliran = useRef<MediaStream | null>(null);
  const cadangan = useRef<HTMLInputElement>(null);
  const [siap, setSiap] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);
  const [cobaLagi, setCobaLagi] = useState(0);
  const [seluler, setSeluler] = useState(false);
  const [sedangAmbil, setSedangAmbil] = useState(false);

  useEffect(() => {
    if (!terbuka) setSedangAmbil(false);
  }, [terbuka]);

  useEffect(() => {
    setSeluler(perangkatSeluler(navigator.userAgent, navigator.maxTouchPoints || 0));
  }, []);

  useEffect(() => {
    if (!terbuka) return;
    let batal = false;

    (async () => {
      setGagal(null);
      setSiap(false);
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: arah === "depan" ? "user" : "environment" } },
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
        setGagal(
          perangkatSeluler(navigator.userAgent, navigator.maxTouchPoints || 0)
            ? "Kamera tidak bisa dibuka langsung. Izinkan akses kamera untuk browser ini, lalu coba lagi. Kalau tetap gagal, pakai tombol kamera bawaan HP."
            : "Kamera komputer tidak bisa dibuka. Klik ikon gembok di sebelah alamat situs, izinkan Kamera, lalu tekan Coba lagi. Kalau komputer tidak punya kamera, absen memakai HP."
        );
      }
    })();

    return () => {
      batal = true;
      aliran.current?.getTracks().forEach((t) => t.stop());
      aliran.current = null;
    };
  }, [terbuka, arah, cobaLagi]);

  function ambil() {
    const v = video.current;
    if (!v || sedangAmbil || memproses) return;
    setSedangAmbil(true);

    // Langsung kecilkan ke ukuran optimal (maksimal 800 px) saat mengambil dari video
    // supaya ukuran berkas langsung kecil (~50 KB) dan proses kirim instan di laptop maupun HP.
    const maksSisi = 800;
    const skala = Math.min(1, maksSisi / Math.max(v.videoWidth || 1, v.videoHeight || 1));
    const kanvas = document.createElement("canvas");
    kanvas.width = Math.round((v.videoWidth || 640) * skala);
    kanvas.height = Math.round((v.videoHeight || 480) * skala);
    kanvas.getContext("2d")?.drawImage(v, 0, 0, kanvas.width, kanvas.height);

    kanvas.toBlob(
      (b) => {
        if (!b) {
          setSedangAmbil(false);
          return;
        }
        onFoto(new File([b], "absen.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.8
    );
  }

  if (!terbuka) return null;

  const sibuk = sedangAmbil || memproses;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-allegro-800">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-semibold text-white">{judul}</p>
        <button className="btn-ringan" onClick={onBatal} disabled={sibuk}>
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
        {sibuk && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 text-white">
            <div className="flex flex-col items-center gap-2">
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
              <p className="text-sm font-medium">Menyimpan absen…</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pb-8 pt-4">
        {siap && (
          <button className="btn-lapangan" onClick={ambil} disabled={sibuk}>
            {sibuk ? "Sedang menyimpan…" : "Ambil foto"}
          </button>
        )}

        {gagal && (
          <button className="btn-ringan w-full" onClick={() => setCobaLagi((n) => n + 1)} disabled={sibuk}>
            Coba nyalakan kamera lagi
          </button>
        )}

        {/* Cadangan hanya untuk HP yang kamera langsungnya gagal. */}
        {gagal && seluler && (
          <>
            <input
              ref={cadangan}
              type="file"
              accept="image/*"
              capture={arah === "depan" ? "user" : "environment"}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (!f.type.startsWith("image/") || !fotoMasihBaru(f.lastModified, Date.now())) {
                  setGagal("Foto harus diambil langsung dengan kamera saat ini juga, bukan dipilih dari galeri.");
                  return;
                }
                setSedangAmbil(true);
                onFoto(f);
              }}
            />
            <button className="btn-lapangan" onClick={() => cadangan.current?.click()} disabled={sibuk}>
              {sibuk ? "Sedang menyimpan…" : "Pakai kamera bawaan HP"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
