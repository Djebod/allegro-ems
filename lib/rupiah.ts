/** "150000" -> "150.000" untuk dibaca, dan sebaliknya untuk disimpan. */
export function keRupiah(angka: number): string {
  return new Intl.NumberFormat("id-ID").format(angka);
}

export function bacaAngka(teks: string): number {
  const bersih = teks.replace(/[^\d]/g, "");
  return bersih ? Number(bersih) : 0;
}

export function rupiahPenuh(angka: number): string {
  return `Rp ${keRupiah(angka)}`;
}
