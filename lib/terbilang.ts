/**
 * Angka ke kata-kata bahasa Indonesia, untuk baris "Terbilang" di slip gaji.
 * 4.425.000 -> "empat juta empat ratus dua puluh lima ribu rupiah"
 */
const SATUAN = [
  "", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas",
];

function kata(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} puluh ${kata(n % 10)}`;
  if (n < 200) return `seratus ${kata(n - 100)}`;
  if (n < 1000) return `${SATUAN[Math.floor(n / 100)]} ratus ${kata(n % 100)}`;
  if (n < 2000) return `seribu ${kata(n - 1000)}`;
  if (n < 1_000_000) return `${kata(Math.floor(n / 1000))} ribu ${kata(n % 1000)}`;
  if (n < 1_000_000_000) return `${kata(Math.floor(n / 1_000_000))} juta ${kata(n % 1_000_000)}`;
  if (n < 1_000_000_000_000) return `${kata(Math.floor(n / 1_000_000_000))} miliar ${kata(n % 1_000_000_000)}`;
  return `${kata(Math.floor(n / 1_000_000_000_000))} triliun ${kata(n % 1_000_000_000_000)}`;
}

export function terbilang(angka: number): string {
  const n = Math.round(Math.abs(angka));
  if (n === 0) return "nol rupiah";
  const hasil = kata(n).replace(/\s+/g, " ").trim();
  return `${angka < 0 ? "minus " : ""}${hasil} rupiah`;
}
