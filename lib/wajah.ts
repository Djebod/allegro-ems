import { BATAS_WAJAH_MIRIP, BATAS_WAJAH_RAGU, BATAS_WAJAH_SANGAT_MIRIP } from "@/lib/constants";

/**
 * Tafsir hasil pembanding wajah. Bagian ini murni hitungan supaya bisa
 * diuji tanpa browser; yang memuat model dan membaca gambar ada di
 * lib/banding-wajah.ts.
 */

export type TingkatKemiripan = "SANGAT_MIRIP" | "MIRIP" | "RAGU" | "BERBEDA";

export interface TafsirKemiripan {
  tingkat: TingkatKemiripan;
  label: string;
  saran: string;
  /** Jarak dua sidik wajah, dua angka di belakang koma. */
  jarak: number;
  /** 0-100 untuk bilah di layar. Bukan persentase kepastian. */
  skor: number;
}

function angka(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export const PANDUAN_KEMIRIPAN: {
  tingkat: TingkatKemiripan;
  rentang: string;
  label: string;
  saran: string;
}[] = [
  {
    tingkat: "SANGAT_MIRIP",
    rentang: `di bawah ${angka(BATAS_WAJAH_SANGAT_MIRIP)}`,
    label: "Sangat mirip",
    saran: "Kemungkinan besar orang yang sama. Validasi bisa dilanjutkan.",
  },
  {
    tingkat: "MIRIP",
    rentang: `${angka(BATAS_WAJAH_SANGAT_MIRIP)} – ${angka(BATAS_WAJAH_MIRIP)}`,
    label: "Mirip",
    saran: "Kemungkinan orang yang sama. Lihat sekilas kedua foto sebelum memvalidasi.",
  },
  {
    tingkat: "RAGU",
    rentang: `${angka(BATAS_WAJAH_MIRIP)} – ${angka(BATAS_WAJAH_RAGU)}`,
    label: "Meragukan",
    saran: "Bandingkan sendiri dengan teliti; bila perlu tanyakan ke atasannya.",
  },
  {
    tingkat: "BERBEDA",
    rentang: `di atas ${angka(BATAS_WAJAH_RAGU)}`,
    label: "Berbeda",
    saran: "Kemungkinan bukan orang yang sama. Jangan divalidasi sebelum dicek langsung.",
  },
];

export function tafsirKemiripan(jarak: number): TafsirKemiripan {
  const j = Math.round(jarak * 100) / 100;
  const tingkat: TingkatKemiripan =
    j < BATAS_WAJAH_SANGAT_MIRIP
      ? "SANGAT_MIRIP"
      : j < BATAS_WAJAH_MIRIP
      ? "MIRIP"
      : j < BATAS_WAJAH_RAGU
      ? "RAGU"
      : "BERBEDA";
  const p = PANDUAN_KEMIRIPAN.find((x) => x.tingkat === tingkat)!;
  return {
    tingkat,
    label: p.label,
    saran: p.saran,
    jarak: j,
    skor: Math.max(0, Math.min(100, Math.round((1 - j) * 100))),
  };
}

/** Jarak euclidean dua sidik wajah; sama persis = 0. */
export function jarakSidik(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length === 0 || a.length !== b.length) throw new Error("Sidik wajah tidak sebanding.");
  let jumlah = 0;
  for (let i = 0; i < a.length; i++) {
    const beda = a[i] - b[i];
    jumlah += beda * beda;
  }
  return Math.sqrt(jumlah);
}

export function teksJarak(jarak: number): string {
  return angka(jarak);
}

export function warnaKemiripan(t: TingkatKemiripan): string {
  if (t === "SANGAT_MIRIP") return "bg-green-100 text-green-800";
  if (t === "MIRIP") return "bg-allegro-100 text-allegro-700";
  if (t === "RAGU") return "bg-kuning-400/40 text-allegro-800";
  return "bg-red-100 text-bahaya";
}
