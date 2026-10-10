"use client";

import Image from "next/image";
import { useState } from "react";
import { fotoKecil } from "@/lib/cloudinary";
import { bandingkanWajah } from "@/lib/banding-wajah";
import { PANDUAN_KEMIRIPAN, tafsirKemiripan, teksJarak, warnaKemiripan, type TafsirKemiripan } from "@/lib/wajah";

/**
 * Thumbnail KTP di sebelah foto absen, plus tombol pembanding wajah.
 * Hanya dipasang untuk yang boleh membaca employeePrivate (Admin/HR/Owner);
 * pemanggil yang memutuskan, komponen ini tidak membaca Firestore.
 */
export default function BandingWajah({
  fotoAbsen,
  fotoKtp,
  namaSesi,
}: {
  fotoAbsen: string;
  /** null = KTP belum diunggah; undefined = masih dimuat. */
  fotoKtp: string | null | undefined;
  namaSesi: string;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<TafsirKemiripan | null>(null);
  const [salah, setSalah] = useState<string | null>(null);

  async function bandingkan() {
    if (!fotoKtp) return;
    setSibuk(true);
    setSalah(null);
    setHasil(null);
    try {
      const h = await bandingkanWajah(fotoAbsen, fotoKtp);
      if ("gagal" in h) {
        setSalah(
          h.gagal === "KTP"
            ? "Wajah di foto KTP tidak terdeteksi. Minta Admin mengunggah ulang foto KTP yang lebih jelas."
            : "Wajah di foto absen tidak terdeteksi. Bandingkan dengan mata sendiri."
        );
      } else {
        setHasil(tafsirKemiripan(h.jarak));
      }
    } catch (e) {
      setSalah(
        e instanceof Error && e.message
          ? `Pembanding wajah gagal dimuat: ${e.message}`
          : "Pembanding wajah gagal dimuat. Periksa sambungan internet lalu coba lagi."
      );
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-center">
          {fotoKtp === undefined ? (
            <div className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-line text-[10px] text-muted">
              memuat…
            </div>
          ) : fotoKtp === null ? (
            <div className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-line px-1 text-center text-[10px] text-muted">
              KTP belum diunggah
            </div>
          ) : (
            <a href={fotoKtp} target="_blank" rel="noopener noreferrer">
              <Image
                src={fotoKecil(fotoKtp, 160)}
                alt={`Foto KTP untuk pembanding ${namaSesi}`}
                width={80}
                height={80}
                className="h-20 w-20 rounded-lg border border-line object-cover"
                unoptimized
              />
            </a>
          )}
          <p className="mt-1 text-[10px] text-muted">Foto KTP</p>
        </div>

        <div className="min-w-0 flex-1 text-xs">
          {fotoKtp ? (
            <>
              <button className="btn-ringan" onClick={bandingkan} disabled={sibuk}>
                {sibuk ? "Membandingkan…" : hasil || salah ? "Bandingkan ulang" : "Bandingkan wajah"}
              </button>
              {hasil && (
                <div className="mt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`label-status ${warnaKemiripan(hasil.tingkat)}`}>{hasil.label}</span>
                    <span className="text-muted">jarak {teksJarak(hasil.jarak)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full max-w-[12rem] overflow-hidden rounded bg-surface">
                    <div
                      className={`h-full ${
                        hasil.tingkat === "BERBEDA"
                          ? "bg-bahaya"
                          : hasil.tingkat === "RAGU"
                          ? "bg-kuning-400"
                          : "bg-green-600"
                      }`}
                      style={{ width: `${hasil.skor}%` }}
                    />
                  </div>
                  <p className="mt-1 text-ink">{hasil.saran}</p>
                </div>
              )}
              {salah && <p className="mt-2 text-bahaya">{salah}</p>}
            </>
          ) : (
            fotoKtp === null && (
              <p className="text-muted">Unggah foto KTP di Data Karyawan supaya wajahnya bisa dibandingkan.</p>
            )
          )}
        </div>
      </div>

      {(hasil || salah) && (
        <details className="text-[11px] text-muted">
          <summary className="cursor-pointer select-none">Panduan tingkat kemiripan</summary>
          <table className="mt-1 w-full max-w-md text-left">
            <tbody>
              {PANDUAN_KEMIRIPAN.map((p) => (
                <tr key={p.tingkat} className="align-top">
                  <td className="whitespace-nowrap py-0.5 pr-2">
                    <span className={`label-status ${warnaKemiripan(p.tingkat)}`}>{p.label}</span>
                  </td>
                  <td className="whitespace-nowrap py-0.5 pr-2">jarak {p.rentang}</td>
                  <td className="py-0.5">{p.saran}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1">
            Angka ini hitungan model di browser, bukan keputusan. Foto KTP yang buram atau lama bisa membuat orang
            yang sama terbaca &quot;meragukan&quot;. Yang memutuskan tetap Admin yang menandatangani validasi.
          </p>
        </details>
      )}
    </div>
  );
}
