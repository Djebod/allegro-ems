"use client";

import { useEffect, useRef, useState } from "react";

const TINGGI = 160;

/**
 * Kotak tanda tangan: digoreskan dengan jari atau tetikus, lalu diubah jadi
 * berkas PNG yang diserahkan ke pemanggil lewat onUbah. Latar diisi putih
 * supaya hasilnya tetap terbaca bila nanti dikompres ke JPEG.
 *
 * Sengaja tidak menyimpan tanda tangan untuk dipakai ulang: tiap revisi
 * absen harus ditandatangani saat itu juga, seperti membubuhkan paraf di
 * kertas, supaya tidak ada revisi yang "tertandatangani" tanpa disadari.
 */
export default function TandaTangan({
  label = "Tanda tangan",
  bantuan,
  onUbah,
}: {
  label?: string;
  bantuan?: string;
  onUbah: (berkas: File | null) => void;
}) {
  const kanvas = useRef<HTMLCanvasElement>(null);
  const menggambar = useRef(false);
  const [adaGoresan, setAdaGoresan] = useState(false);

  function siapkan() {
    const k = kanvas.current;
    if (!k) return null;
    const skala = window.devicePixelRatio || 1;
    const lebar = k.clientWidth || 320;
    if (k.width !== Math.round(lebar * skala)) {
      k.width = Math.round(lebar * skala);
      k.height = Math.round(TINGGI * skala);
      const ctx = k.getContext("2d");
      if (!ctx) return null;
      ctx.scale(skala, skala);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, lebar, TINGGI);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1b2a4a";
    }
    return k.getContext("2d");
  }

  useEffect(() => {
    siapkan();
  }, []);

  function titik(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function mulai(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = siapkan();
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    menggambar.current = true;
    const { x, y } = titik(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function gerak(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!menggambar.current) return;
    const ctx = kanvas.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = titik(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!adaGoresan) setAdaGoresan(true);
  }

  function selesai() {
    if (!menggambar.current) return;
    menggambar.current = false;
    const k = kanvas.current;
    if (!k) return;
    k.toBlob((b) => {
      if (!b) return;
      onUbah(new File([b], "tanda-tangan.png", { type: "image/png" }));
    }, "image/png");
  }

  function hapus() {
    const k = kanvas.current;
    const ctx = k?.getContext("2d");
    if (!k || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, k.width, k.height);
    ctx.restore();
    setAdaGoresan(false);
    onUbah(null);
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-ink">
        {label} <span className="text-bahaya">*</span>
      </p>
      {bantuan && <p className="mb-2 text-xs text-muted">{bantuan}</p>}
      <canvas
        ref={kanvas}
        style={{ height: TINGGI, touchAction: "none" }}
        className="w-full cursor-crosshair rounded-lg border border-line bg-white"
        onPointerDown={mulai}
        onPointerMove={gerak}
        onPointerUp={selesai}
        onPointerCancel={selesai}
        onPointerLeave={selesai}
      />
      <div className="mt-2 flex items-center gap-3">
        <button type="button" className="btn-ringan" onClick={hapus} disabled={!adaGoresan}>
          Hapus goresan
        </button>
        <span className="text-xs text-muted">
          {adaGoresan ? "Tanda tangan siap." : "Goreskan tanda tangan di kotak."}
        </span>
      </div>
    </div>
  );
}
