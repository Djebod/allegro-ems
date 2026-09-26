"use client";

import Image from "next/image";
import { useState } from "react";
import { fotoKecil } from "@/lib/cloudinary";

function inisial(nama: string): string {
  const bagian = nama.trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 0) return "?";
  if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
}

/**
 * Foto kecil karyawan. Kalau belum ada fotonya - atau tautannya gagal
 * dimuat - yang tampil inisial namanya, bukan kotak kosong.
 */
export default function FotoKaryawan({
  nama,
  url,
  px = 48,
}: {
  nama: string;
  url?: string | null;
  px?: number;
}) {
  const [gagal, setGagal] = useState(false);
  const ukuran = { width: px, height: px };

  if (!url || gagal) {
    return (
      <div
        style={ukuran}
        className="grid shrink-0 place-items-center rounded-full bg-allegro-100 text-sm font-bold text-allegro-700"
        aria-hidden
      >
        {inisial(nama)}
      </div>
    );
  }

  return (
    <Image
      src={fotoKecil(url, px * 2)}
      alt={`Foto ${nama}`}
      width={px}
      height={px}
      style={ukuran}
      className="shrink-0 rounded-full border border-line object-cover"
      onError={() => setGagal(true)}
      unoptimized
    />
  );
}
