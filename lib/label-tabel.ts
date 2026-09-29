/**
 * Memberi setiap sel tabel label dari judul kolomnya (atribut data-label),
 * supaya di layar HP tabel bisa tampil sebagai kartu: tiap baris jadi satu
 * kartu, tiap sel jadi "Judul ....... isi". Lihat .tabel-padat di globals.css.
 *
 * Dijalankan otomatis untuk semua tabel .tabel-padat, jadi halaman baru tidak
 * perlu menulis label satu per satu. Tabel yang memang harus tetap berbentuk
 * tabel di HP (mis. rincian harian 31 tanggal) diberi kelas "tetap-tabel".
 */

/** Teks judul kolom tanpa tombol urut dan tombol tampil/sembunyikan. */
export function bersihkanJudul(teks: string): string {
  return teks
    .replace(/[▲▼↕]/g, "")
    .replace(/\b(Tampilkan|Sembunyikan)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Judul tiap kolom, memperhitungkan colSpan. */
export function judulKolom(baris: { colSpan: number; textContent: string | null }[]): string[] {
  const hasil: string[] = [];
  baris.forEach((th) => {
    const judul = bersihkanJudul(th.textContent || "");
    for (let i = 0; i < Math.max(1, th.colSpan || 1); i++) hasil.push(judul);
  });
  return hasil;
}

export function labeliTabel(akar: ParentNode) {
  akar.querySelectorAll<HTMLTableElement>("table.tabel-padat:not(.tetap-tabel)").forEach((tabel) => {
    const kepala = tabel.tHead?.rows[tabel.tHead.rows.length - 1];
    if (!kepala) return;
    const judul = judulKolom(Array.from(kepala.cells));
    Array.from(tabel.tBodies).forEach((tb) =>
      Array.from(tb.rows).forEach((tr) => {
        let kolom = 0;
        Array.from(tr.cells).forEach((td) => {
          const label = td.colSpan > 1 ? "" : judul[kolom] || "";
          if (td.getAttribute("data-label") !== label) td.setAttribute("data-label", label);
          // Kolom nomor urut tidak berguna di kartu; kolom sesudahnya jadi judul kartu.
          const nomor = kolom === 0 && td.colSpan <= 1 && /^no\.?$/i.test(label);
          if (nomor && !td.hasAttribute("data-nomor")) td.setAttribute("data-nomor", "");
          kolom += Math.max(1, td.colSpan || 1);
        });
      })
    );
  });
}
