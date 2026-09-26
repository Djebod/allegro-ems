"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cloudinarySiap, unggahFoto } from "@/lib/cloudinary";

export default function UnggahFoto({
  label,
  keterangan,
  folder,
  urlSekarang,
  onSelesai,
}: {
  label: string;
  keterangan?: string;
  folder: string;
  urlSekarang?: string | null;
  onSelesai: (url: string, publicId: string) => Promise<void> | void;
}) {
  const berkas = useRef<HTMLInputElement>(null);
  const [proses, setProses] = useState(false);
  const [salah, setSalah] = useState<string | null>(null);

  async function pilih(file: File | undefined) {
    if (!file) return;
    setSalah(null);
    setProses(true);
    try {
      const hasil = await unggahFoto(file, folder);
      await onSelesai(hasil.url, hasil.publicId);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Foto gagal diunggah.");
    } finally {
      setProses(false);
      if (berkas.current) berkas.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-ink">{label}</p>
      {keterangan && <p className="mb-2 text-xs text-muted">{keterangan}</p>}

      {urlSekarang ? (
        <a href={urlSekarang} target="_blank" rel="noopener noreferrer" className="inline-block">
          <Image
            src={urlSekarang}
            alt={label}
            width={120}
            height={120}
            className="h-28 w-28 rounded-lg border border-line object-cover"
            unoptimized
          />
        </a>
      ) : (
        <div className="grid h-28 w-28 place-items-center rounded-lg border border-dashed border-line text-xs text-muted">
          Belum ada
        </div>
      )}

      <input
        ref={berkas}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pilih(e.target.files?.[0])}
      />

      <button
        type="button"
        className="btn-ringan mt-3"
        disabled={proses || !cloudinarySiap()}
        onClick={() => berkas.current?.click()}
      >
        {proses ? "Mengunggah…" : urlSekarang ? "Ganti foto" : "Pilih foto"}
      </button>

      {!cloudinarySiap() && (
        <p className="mt-2 text-xs text-muted">
          Cloudinary belum diatur. Isi dua Environment Variable Cloudinary, lalu Redeploy.
        </p>
      )}

      {salah && <p className="mt-2 text-xs text-bahaya">{salah}</p>}
    </div>
  );
}
