"use client";

import { useRef, useState } from "react";
import { Field, Pesan } from "@/components/Field";
import { unggahFoto } from "@/lib/cloudinary";
import { keKotakJam } from "@/lib/absensi";
import type { Attendance, HasilValidasi, JenisSesi } from "@/types";

const FOLDER_KOREKSI = "allegro/koreksi";

export default function FormValidasi({
  absen,
  jenis,
  onSimpan,
}: {
  absen: Attendance;
  jenis: JenisSesi;
  onSimpan: (data: {
    hasil: HasilValidasi;
    alasan: string;
    buktiUrl: string | null;
    jamAktual: string;
  }) => Promise<void>;
}) {
  const event = absen[jenis];
  const sudah = event?.validasi || null;

  const [buka, setBuka] = useState(false);
  const [hasil, setHasil] = useState<HasilValidasi>(sudah?.hasil || "VALID");
  const [alasan, setAlasan] = useState(sudah?.alasan || "");
  const [bukti, setBukti] = useState<string | null>(sudah?.buktiUrl || null);
  const [jam, setJam] = useState(keKotakJam(event?.waktuAktual));
  const [salah, setSalah] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  if (!event) return null;

  async function pilihBukti(file?: File) {
    if (!file) return;
    setSalah(null);
    setSibuk(true);
    try {
      const hasilUnggah = await unggahFoto(file, FOLDER_KOREKSI);
      setBukti(hasilUnggah.url);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Foto bukti gagal diunggah.");
    } finally {
      setSibuk(false);
      if (berkas.current) berkas.current.value = "";
    }
  }

  async function simpan() {
    setSalah(null);
    if (hasil === "TIDAK_VALID" && !alasan.trim()) {
      return setSalah("Alasan wajib diisi.");
    }
    if (hasil === "TIDAK_VALID" && !bukti) {
      return setSalah("Foto bukti wajib dilampirkan.");
    }
    setSibuk(true);
    try {
      await onSimpan({ hasil, alasan, buktiUrl: bukti, jamAktual: jam });
      setBuka(false);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Validasi gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  if (!buka) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {sudah ? (
          <span
            className={`label-status ${
              sudah.hasil === "VALID" ? "bg-green-100 text-green-800" : "bg-red-100 text-bahaya"
            }`}
          >
            {sudah.hasil === "VALID" ? "Sudah divalidasi" : "Dinyatakan tidak valid"}
          </span>
        ) : (
          <span className="label-status bg-surface text-muted">Belum divalidasi</span>
        )}
        {event.waktuAktual && (
          <span className="text-xs font-semibold text-allegro-700">
            Jam dikoreksi ke {keKotakJam(event.waktuAktual)}
          </span>
        )}
        <button className="btn-ringan" onClick={() => setBuka(true)}>
          {sudah ? "Ubah penilaian" : "Validasi"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {salah && <Pesan jenis="gagal" isi={salah} />}

      <div className="flex gap-4">
        {(["VALID", "TIDAK_VALID"] as HasilValidasi[]).map((v) => (
          <label key={v} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name={`validasi-${absen.id}-${jenis}`}
              checked={hasil === v}
              onChange={() => setHasil(v)}
            />
            {v === "VALID" ? "Valid" : "Tidak valid"}
          </label>
        ))}
      </div>

      <Field
        label="Jam yang seharusnya"
        bantuan="Kosongkan bila jamnya tidak perlu diubah. Jam asli tetap tersimpan."
      >
        <input
          type="time"
          className="input-dasar max-w-[10rem]"
          value={jam}
          onChange={(e) => setJam(e.target.value)}
        />
      </Field>

      {hasil === "TIDAK_VALID" && (
        <>
          <Field label="Alasan" wajib>
            <textarea
              className="input-dasar"
              rows={2}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Tercatat lembur tetapi menurut laporan pengawas tidak ada pekerjaan malam itu."
            />
          </Field>

          <div>
            <p className="mb-1 text-sm font-medium text-ink">
              Foto bukti <span className="text-bahaya">*</span>
            </p>
            <input
              ref={berkas}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pilihBukti(e.target.files?.[0])}
            />
            <div className="flex items-center gap-3">
              <button className="btn-ringan" onClick={() => berkas.current?.click()} disabled={sibuk}>
                {bukti ? "Ganti bukti" : "Pilih dari galeri"}
              </button>
              {bukti && (
                <a
                  href={bukti}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline decoration-line underline-offset-2"
                >
                  Lihat bukti terlampir
                </a>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button className="btn-utama" onClick={simpan} disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan penilaian"}
        </button>
        <button className="btn-ringan" onClick={() => setBuka(false)} disabled={sibuk}>
          Batal
        </button>
      </div>
    </div>
  );
}
