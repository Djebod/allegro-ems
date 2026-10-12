"use client";

import Image from "next/image";
import { useState } from "react";
import { fotoKecil } from "@/lib/cloudinary";
import { bandingkanWajah, type FotoGagal } from "@/lib/banding-wajah";
import { PANDUAN_KEMIRIPAN, tafsirKemiripan, teksJarak, warnaKemiripan, type TafsirKemiripan } from "@/lib/wajah";

/**
 * Thumbnail foto profil karyawan di sebelah foto absen, plus tombol pembanding wajah.
 * Dipakai foto profil, bukan KTP, karena foto KTP sering bertahun-tahun lalu dan
 * wajahnya sudah jauh berubah (Bang Syam, 12 Okt 2026). Hanya untuk Admin/HR/Owner;
 * pemanggil yang memutuskan, komponen ini tidak membaca Firestore.
 */
/**
 * Kalau kedua foto gagal, hampir pasti bukan salah fotonya melainkan
 * pendeteksinya tidak berjalan di browser ini; jangan menyalahkan karyawan.
 */
function pesanGagal(gagal: FotoGagal[]): string {
  if (gagal.includes("ABSEN") && gagal.includes("PROFIL")) {
    return (
      "Wajah tidak terdeteksi di foto absen maupun foto profil. Kemungkinan pembanding tidak berjalan di browser ini. " +
      "Coba muat ulang halaman atau pakai Chrome di laptop; kalau masih gagal, bandingkan dengan mata sendiri."
    );
  }
  if (gagal.includes("PROFIL")) {
    return (
      "Wajah di foto profil tidak terdeteksi, padahal wajah di foto absen terbaca. " +
      "Pastikan foto profil menampilkan wajah dari depan, terang, dan cukup besar (bukan foto seluruh badan), lalu minta karyawan menggantinya."
    );
  }
  return "Wajah di foto absen tidak terdeteksi. Bandingkan dengan mata sendiri.";
}

export default function BandingWajah({
  fotoAbsen,
  fotoProfil,
  namaSesi,
}: {
  fotoAbsen: string;
  /** null = foto profil belum diunggah; undefined = masih dimuat. */
  fotoProfil: string | null | undefined;
  namaSesi: string;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<TafsirKemiripan | null>(null);
  const [salah, setSalah] = useState<string | null>(null);

  async function bandingkan() {
    if (!fotoProfil) return;
    setSibuk(true);
    setSalah(null);
    setHasil(null);
    try {
      const h = await bandingkanWajah(fotoAbsen, fotoProfil);
      if ("gagal" in h) {
        setSalah(pesanGagal(h.gagal));
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
          {fotoProfil === undefined ? (
            <div className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-line text-[10px] text-muted">
              memuat…
            </div>
          ) : fotoProfil === null ? (
            <div className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-line px-1 text-center text-[10px] text-muted">
              Foto profil belum ada
            </div>
          ) : (
            <a href={fotoProfil} target="_blank" rel="noopener noreferrer">
              <Image
                src={fotoKecil(fotoProfil, 160)}
                alt={`Foto profil untuk pembanding ${namaSesi}`}
                width={80}
                height={80}
                className="h-20 w-20 rounded-lg border border-line object-cover"
                unoptimized
              />
            </a>
          )}
          <p className="mt-1 text-[10px] text-muted">Foto profil</p>
        </div>

        <div className="min-w-0 flex-1 text-xs">
          {fotoProfil ? (
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
            fotoProfil === null && (
              <p className="text-muted">Karyawan belum punya foto profil. Minta ia mengunggahnya dari Beranda → Data Pribadi supaya wajahnya bisa dibandingkan.</p>
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
            Angka ini hitungan model di browser, bukan keputusan. Foto profil yang buram, gelap, atau diambil dari jauh bisa membuat
            orang yang sama terbaca &quot;meragukan&quot;. Yang memutuskan tetap Admin yang menandatangani validasi.
          </p>
        </details>
      )}
    </div>
  );
}
