"use client";

import { ARTI_KODE, namaBulan, type BarisRekap, type HasilRekap, type KodeHari } from "@/lib/rekap-kantor";

/*
 * Ekspor rekap bulanan absensi kantor.
 *
 * Kedua pustaka (ExcelJS dan jsPDF) dimuat hanya saat tombolnya ditekan,
 * supaya halaman tetap ringan untuk yang sekadar melihat.
 */

const TEAL = "19404F";
const KUNING = "FAD131";
const ABU = "ECEBE7";

/** Warna sel per kode: latar dan teks. */
const WARNA_KODE: Record<Exclude<KodeHari, "">, { latar: string; teks: string }> = {
  H: { latar: "FFFFFF", teks: "1B2B33" },
  T: { latar: "FDE7B0", teks: "7A4B00" },
  P: { latar: "FDE7B0", teks: "7A4B00" },
  C: { latar: "D6E0E4", teks: "19404F" },
  S: { latar: "D6E0E4", teks: "19404F" },
  I: { latar: "D6E0E4", teks: "19404F" },
  D: { latar: "E3F1E6", teks: "1E5B2E" },
  M: { latar: "FFF4C2", teks: "6B5600" },
  A: { latar: "F9D4D1", teks: "B3261E" },
  L: { latar: "ECEBE7", teks: "61727A" },
};

const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** Dua huruf untuk kolom sempit PDF; "Se" saja tidak membedakan Senin dan Selasa. */
const HARI_DUA: Record<string, string> = {
  Min: "Mg", Sen: "Sn", Sel: "Sl", Rab: "Rb", Kam: "Km", Jum: "Jm", Sab: "Sb",
};

function hariDari(tanggal: string): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  return HARI_PENDEK[new Date(t, b - 1, h).getDay()];
}

interface KolomRingkas {
  judul: string;
  ambil: (b: BarisRekap, i: number) => string | number;
  lebar: number;
  angka?: boolean;
}

const KOLOM: KolomRingkas[] = [
  { judul: "No", ambil: (_, i) => i + 1, lebar: 5, angka: true },
  { judul: "Kode", ambil: (b) => b.employeeId, lebar: 11 },
  { judul: "Nama", ambil: (b) => b.nama, lebar: 26 },
  { judul: "Divisi", ambil: (b) => b.divisi, lebar: 14 },
  { judul: "Hari kerja", ambil: (b) => b.hariKerja, lebar: 8, angka: true },
  { judul: "Hadir", ambil: (b) => b.hadir, lebar: 7, angka: true },
  { judul: "Telat (kali)", ambil: (b) => b.terlambatKali, lebar: 8, angka: true },
  { judul: "Telat (menit)", ambil: (b) => b.terlambatMenit, lebar: 9, angka: true },
  { judul: "Skor telat", ambil: (b) => b.skorTelat, lebar: 7, angka: true },
  { judul: "Denda telat", ambil: (b) => b.dendaTelat, lebar: 11, angka: true },
  { judul: "Pulang cepat (menit)", ambil: (b) => b.pulangCepatMenit, lebar: 10, angka: true },
  { judul: "Tidak absen pulang", ambil: (b) => b.tidakAbsenPulang, lebar: 9, angka: true },
  { judul: "Cuti", ambil: (b) => b.cuti, lebar: 6, angka: true },
  { judul: "Sakit", ambil: (b) => b.sakit, lebar: 6, angka: true },
  { judul: "Izin", ambil: (b) => b.izin, lebar: 6, angka: true },
  { judul: "Dinas", ambil: (b) => b.dinas, lebar: 6, angka: true },
  { judul: "Menunggu", ambil: (b) => b.menunggu, lebar: 8, angka: true },
  { judul: "Alpa", ambil: (b) => b.alpa, lebar: 6, angka: true },
  { judul: "Masuk hari libur", ambil: (b) => b.masukHariLibur, lebar: 8, angka: true },
  { judul: "Jam kerja", ambil: (b) => b.jamKerja, lebar: 8, angka: true },
  { judul: "% Hadir", ambil: (b) => b.persenHadir, lebar: 7, angka: true },
];

function jumlahKolom(baris: BarisRekap[], i: number): string | number {
  const k = KOLOM[i];
  if (!k.angka || i === 0 || k.judul === "% Hadir") return "";
  const t = baris.reduce((s, b, n) => s + Number(k.ambil(b, n) || 0), 0);
  return Math.round(t * 100) / 100;
}

function ribuan(n: number): string {
  return n ? n.toLocaleString("id-ID") : "0";
}

function namaBerkas(hasil: HasilRekap, ext: string) {
  return `Rekap-Absensi-Kantor-${hasil.bulan}.${ext}`;
}

export function unduh(berkas: Blob, nama: string) {
  const tautan = document.createElement("a");
  tautan.href = URL.createObjectURL(berkas);
  tautan.download = nama;
  tautan.click();
  setTimeout(() => URL.revokeObjectURL(tautan.href), 1000);
}

export async function ambilLogo(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch("/logo.png");
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export function keDataUrl(buf: ArrayBuffer): string {
  let biner = "";
  new Uint8Array(buf).forEach((b) => (biner += String.fromCharCode(b)));
  return `data:image/png;base64,${btoa(biner)}`;
}

/* ============================== EXCEL ============================== */

export async function eksporRekapExcel(opsi: {
  hasil: HasilRekap;
  baris: BarisRekap[];
  dibuatOleh: string;
  keteranganSaringan?: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Allegro Global Construction";
  wb.created = new Date();
  const logo = await ambilLogo();
  const idLogo = logo ? wb.addImage({ buffer: logo, extension: "png" }) : null;
  const periode = namaBulan(opsi.hasil.bulan);

  type Lembar = import("exceljs").Worksheet;

  function kop(ws: Lembar, n: number, sub: string) {
    if (idLogo !== null) ws.addImage(idLogo, { tl: { col: 0.2, row: 0.2 }, ext: { width: 50, height: 64 } });
    const tulis = (baris: number, isi: string, font: Partial<import("exceljs").Font>) => {
      ws.mergeCells(baris, 3, baris, n);
      const sel = ws.getCell(baris, 3);
      sel.value = isi;
      sel.font = font;
    };
    tulis(1, "PT ALLEGRO GLOBAL CONSTRUCTION", { size: 16, bold: true, color: { argb: `FF${TEAL}` } });
    tulis(2, sub, { size: 12, bold: true });
    tulis(3, `Periode ${periode}${opsi.keteranganSaringan ? ` · ${opsi.keteranganSaringan}` : ""}`, { size: 10 });
    tulis(4, `Dicetak ${new Date().toLocaleString("id-ID")} oleh ${opsi.dibuatOleh}`, {
      size: 9,
      italic: true,
      color: { argb: "FF61727A" },
    });
    ws.getRow(1).height = 22;
    ws.getRow(5).height = 8;
  }

  function gayaKepala(sel: import("exceljs").Cell) {
    sel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${TEAL}` } };
    sel.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }

  /* ---- lembar 1: ringkasan ---- */
  const ws = wb.addWorksheet("Ringkasan", {
    views: [{ state: "frozen", ySplit: 6, xSplit: 3 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  // Tanpa "header": ExcelJS menulis header ke baris 1 dan merusak kop.
  ws.columns = KOLOM.map((k) => ({ width: k.lebar + 2 }));
  kop(ws, KOLOM.length, "Rekap Bulanan Absensi Kantor");

  const kepala = ws.getRow(6);
  KOLOM.forEach((k, i) => {
    kepala.getCell(i + 1).value = k.judul;
    gayaKepala(kepala.getCell(i + 1));
  });
  kepala.height = 30;

  opsi.baris.forEach((b, n) => {
    const row = ws.addRow(KOLOM.map((k) => k.ambil(b, n)));
    row.font = { size: 10 };
    KOLOM.forEach((k, i) => {
      const sel = row.getCell(i + 1);
      if (k.angka) sel.alignment = { horizontal: "center" };
      if (n % 2 === 1) sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ABU}` } };
    });
    row.getCell(10).numFmt = "#,##0";
    row.getCell(20).numFmt = "0.00";
    row.getCell(21).numFmt = '0.0"%"';
    if (b.capaiSp) row.getCell(9).font = { size: 10, bold: true, color: { argb: "FFB3261E" } };
    if (b.alpa > 0) row.getCell(18).font = { size: 10, bold: true, color: { argb: "FFB3261E" } };
    if (b.terlambatKali > 0) row.getCell(7).font = { size: 10, bold: true, color: { argb: "FF7A4B00" } };
  });

  const total = ws.addRow(KOLOM.map((_, i) => (i === 2 ? `JUMLAH · ${opsi.baris.length} karyawan` : jumlahKolom(opsi.baris, i))));
  total.font = { size: 10, bold: true };
  total.eachCell((sel, kol) => {
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${KUNING}` } };
    if (kol > 4) sel.alignment = { horizontal: "center" };
  });
  total.getCell(10).numFmt = "#,##0";
  total.getCell(20).numFmt = "0.00";

  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: KOLOM.length } };

  const bawah = total.number + 2;
  ws.getCell(bawah, 2).value =
    "Alpa = hari kerja yang sudah lewat tanpa absen, tanpa cuti/izin yang disetujui, dan bukan hari libur. Pengajuan yang belum diputuskan dihitung Menunggu, bukan alpa. Denda telat sesuai pengumuman 1 April 2025; telat berizin yang disetujui bebas denda. Skor 100 sebulan = SP 1.";
  ws.mergeCells(bawah, 2, bawah, KOLOM.length);
  ws.getCell(bawah, 2).font = { size: 9, italic: true, color: { argb: "FF61727A" } };
  ws.getCell(bawah, 2).alignment = { wrapText: true };
  ws.getRow(bawah).height = 26;

  const ttd = bawah + 2;
  [
    [2, "Dibuat oleh"],
    [8, "Diperiksa"],
    [14, "Disetujui"],
  ].forEach(([kol, isi]) => {
    ws.getCell(ttd, kol as number).value = isi as string;
    ws.getCell(ttd, kol as number).font = { size: 10, bold: true };
    ws.getCell(ttd + 4, kol as number).border = { top: { style: "thin" } };
  });

  /* ---- lembar 2: rincian harian ---- */
  const tgl = opsi.hasil.tanggal;
  const n2 = 3 + tgl.length;
  const ws2 = wb.addWorksheet("Rincian harian", {
    views: [{ state: "frozen", ySplit: 7, xSplit: 3 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws2.columns = [{ width: 5 }, { width: 11 }, { width: 26 }, ...tgl.map(() => ({ width: 4.2 }))];
  kop(ws2, n2, "Rincian Harian Absensi Kantor");

  const k1 = ws2.getRow(6);
  const k2 = ws2.getRow(7);
  ["No", "Kode", "Nama"].forEach((j, i) => {
    ws2.mergeCells(6, i + 1, 7, i + 1);
    k1.getCell(i + 1).value = j;
    gayaKepala(k1.getCell(i + 1));
  });
  tgl.forEach((t, i) => {
    const libur = t in opsi.hasil.libur;
    [k1.getCell(i + 4), k2.getCell(i + 4)].forEach((sel, baris) => {
      sel.value = baris === 0 ? Number(t.slice(8)) : hariDari(t);
      gayaKepala(sel);
      if (libur) {
        sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF61727A" } };
      }
    });
  });

  opsi.baris.forEach((b, n) => {
    const row = ws2.addRow([n + 1, b.employeeId, b.nama, ...tgl.map((t) => b.harian[t] || "")]);
    row.font = { size: 9 };
    tgl.forEach((t, i) => {
      const sel = row.getCell(i + 4);
      const kode = b.harian[t];
      sel.alignment = { horizontal: "center" };
      const w = kode ? WARNA_KODE[kode] : null;
      if (w) {
        sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${w.latar}` } };
        sel.font = { size: 9, bold: kode === "A", color: { argb: `FF${w.teks}` } };
      }
      sel.border = { right: { style: "hair", color: { argb: "FFDAD8D2" } } };
    });
  });

  const legenda = ws2.addRow([]).number + 1;
  ws2.getCell(legenda, 2).value = "Keterangan:";
  ws2.getCell(legenda, 2).font = { size: 9, bold: true };
  Object.entries(ARTI_KODE).forEach(([kode, arti], i) => {
    const r = legenda + 1 + Math.floor(i / 2);
    const c = i % 2 === 0 ? 2 : 3;
    const sel = ws2.getCell(r, c);
    sel.value = `${kode} = ${arti}`;
    sel.font = { size: 9, color: { argb: `FF${WARNA_KODE[kode as Exclude<KodeHari, "">].teks}` } };
  });

  const isi = await wb.xlsx.writeBuffer();
  unduh(
    new Blob([isi], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    namaBerkas(opsi.hasil, "xlsx")
  );
}

/* =============================== PDF =============================== */

export function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

export async function eksporRekapPdf(opsi: {
  hasil: HasilRekap;
  baris: BarisRekap[];
  dibuatOleh: string;
  keteranganSaringan?: string;
}) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const lebar = doc.internal.pageSize.getWidth();
  const tinggi = doc.internal.pageSize.getHeight();
  const tepi = 10;
  const logo = await ambilLogo();
  const logoUrl = logo ? keDataUrl(logo) : null;
  const periode = namaBulan(opsi.hasil.bulan);
  const dicetak = `Dicetak ${new Date().toLocaleString("id-ID")} oleh ${opsi.dibuatOleh}`;

  function kop(sub: string): number {
    if (logoUrl) doc.addImage(logoUrl, "PNG", tepi, 8, 13, 16.7);
    const x = tepi + (logoUrl ? 17 : 0);
    doc.setTextColor(...rgb(TEAL));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PT ALLEGRO GLOBAL CONSTRUCTION", x, 13);
    doc.setTextColor(27, 43, 51);
    doc.setFontSize(11);
    doc.text(sub, x, 19);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Periode ${periode}${opsi.keteranganSaringan ? ` - ${opsi.keteranganSaringan}` : ""}`, x, 24);
    doc.setDrawColor(...rgb(KUNING));
    doc.setLineWidth(0.8);
    doc.line(tepi, 28, lebar - tepi, 28);
    return 32;
  }

  const kaki = () => {
    const halaman = doc.getNumberOfPages();
    for (let i = 1; i <= halaman; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(97, 114, 122);
      doc.text(dicetak, tepi, tinggi - 5);
      doc.text(`Halaman ${i} dari ${halaman}`, lebar - tepi, tinggi - 5, { align: "right" });
    }
  };

  /* ---- halaman ringkasan ---- */
  const mulai = kop("Rekap Bulanan Absensi Kantor");
  const JUDUL_PDF = [
    "No", "Kode", "Nama", "Divisi", "Hari kerja", "Hadir", "Telat (x)", "Telat (mnt)", "Skor", "Denda (Rp)",
    "Plg cepat (mnt)", "Tdk absen plg", "Cuti", "Sakit", "Izin", "Dinas", "Mngg", "Alpa",
    "Masuk libur", "Jam kerja", "% Hadir",
  ];

  autoTable(doc, {
    startY: mulai,
    margin: { left: tepi, right: tepi, bottom: 12 },
    head: [JUDUL_PDF],
    body: opsi.baris.map((b, n) =>
      KOLOM.map((k, i) => (i === 9 ? ribuan(Number(k.ambil(b, n))) : String(k.ambil(b, n))))
    ),
    foot: [
      KOLOM.map((_, i) =>
        i === 2
          ? `JUMLAH - ${opsi.baris.length} karyawan`
          : i === 9
          ? ribuan(Number(jumlahKolom(opsi.baris, i)))
          : String(jumlahKolom(opsi.baris, i))
      ),
    ],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.2, lineColor: [218, 216, 210], lineWidth: 0.1, valign: "middle" },
    headStyles: { fillColor: rgb(TEAL), textColor: 255, fontStyle: "bold", halign: "center", fontSize: 6.5 },
    footStyles: { fillColor: rgb(KUNING), textColor: rgb(TEAL), fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: rgb(ABU) },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 18 },
      2: { cellWidth: 36 },
      3: { cellWidth: 18 },
      ...Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i + 4, { halign: "center" as const }])),
      9: { halign: "right" as const, cellWidth: 16 },
    },
    didParseCell: (d) => {
      if (d.section !== "body") return;
      const b = opsi.baris[d.row.index];
      if (d.column.index === 8 && b.capaiSp) {
        d.cell.styles.textColor = rgb("B3261E");
        d.cell.styles.fontStyle = "bold";
      }
      if (d.column.index === 17 && b.alpa > 0) {
        d.cell.styles.textColor = rgb("B3261E");
        d.cell.styles.fontStyle = "bold";
      }
      if (d.column.index === 6 && b.terlambatKali > 0) {
        d.cell.styles.textColor = rgb("7A4B00");
        d.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Tanda tangan di bawah tabel, atau di halaman baru kalau tidak muat.
  const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let y = lastY + 8;
  if (y + 30 > tinggi - 12) {
    doc.addPage();
    y = kop("Rekap Bulanan Absensi Kantor") + 4;
  }
  doc.setFontSize(7.5);
  doc.setTextColor(97, 114, 122);
  doc.text(
    "Alpa = hari kerja yang sudah lewat tanpa absen, tanpa cuti/izin yang disetujui, dan bukan hari libur. Pengajuan yang belum diputuskan dihitung Menunggu (Mngg), bukan alpa. " +
      "Denda telat sesuai pengumuman 1 April 2025: 1-15 menit Rp15.000, 16-30 menit Rp30.000, 31-60 menit Rp60.000, lebih dari 60 menit Rp75.000; telat dengan izin yang disetujui bebas denda. Skor 100 sebulan = SP 1 (angka merah di kolom Skor).",
    tepi,
    y,
    { maxWidth: lebar - tepi * 2 }
  );
  y += 10;
  doc.setTextColor(27, 43, 51);
  doc.setFontSize(9);
  const kolomTtd = [tepi + 20, lebar / 2 - 20, lebar - tepi - 60];
  ["Dibuat oleh", "Diperiksa", "Disetujui"].forEach((t, i) => {
    doc.setFont("helvetica", "bold");
    doc.text(t, kolomTtd[i], y);
    doc.setLineWidth(0.2);
    doc.setDrawColor(27, 43, 51);
    doc.line(kolomTtd[i], y + 18, kolomTtd[i] + 45, y + 18);
  });
  doc.setFont("helvetica", "normal");

  /* ---- halaman rincian harian ---- */
  doc.addPage();
  const mulai2 = kop("Rincian Harian Absensi Kantor");
  const tgl = opsi.hasil.tanggal;
  const lebarTgl = (lebar - tepi * 2 - 8 - 45) / tgl.length;

  autoTable(doc, {
    startY: mulai2,
    margin: { left: tepi, right: tepi, bottom: 12 },
    head: [
      ["No", "Nama", ...tgl.map((t) => t.slice(8))],
      ["", "", ...tgl.map((t) => HARI_DUA[hariDari(t)])],
    ],
    body: opsi.baris.map((b, n) => [String(n + 1), b.nama, ...tgl.map((t) => b.harian[t] || "")]),
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 0.9, halign: "center", lineColor: [218, 216, 210], lineWidth: 0.1 },
    headStyles: { fillColor: rgb(TEAL), textColor: 255, fontStyle: "bold", fontSize: 6 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 45, halign: "left" },
      ...Object.fromEntries(tgl.map((_, i) => [i + 2, { cellWidth: lebarTgl }])),
    },
    didParseCell: (d) => {
      if (d.column.index < 2) return;
      const t = tgl[d.column.index - 2];
      if (d.section === "head" && t in opsi.hasil.libur) {
        d.cell.styles.fillColor = rgb("61727A");
      }
      if (d.section !== "body") return;
      const kode = String(d.cell.raw || "") as KodeHari;
      const w = kode ? WARNA_KODE[kode] : null;
      if (w) {
        d.cell.styles.fillColor = rgb(w.latar);
        d.cell.styles.textColor = rgb(w.teks);
        if (kode === "A") d.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Legenda
  let yl = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  if (yl + 12 > tinggi - 12) {
    doc.addPage();
    yl = kop("Rincian Harian Absensi Kantor") + 4;
  }
  doc.setFontSize(7.5);
  let x = tepi;
  Object.entries(ARTI_KODE).forEach(([kode, arti]) => {
    const w = WARNA_KODE[kode as Exclude<KodeHari, "">];
    const teks = `${arti}`;
    doc.setFillColor(...rgb(w.latar));
    doc.setDrawColor(218, 216, 210);
    doc.rect(x, yl - 3, 5, 4, "FD");
    doc.setTextColor(...rgb(w.teks));
    doc.setFont("helvetica", "bold");
    doc.text(kode, x + 2.5, yl, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(27, 43, 51);
    doc.text(teks, x + 6.5, yl);
    x += 9 + doc.getTextWidth(teks);
    if (x > lebar - 40) {
      x = tepi;
      yl += 6;
    }
  });

  kaki();
  doc.save(namaBerkas(opsi.hasil, "pdf"));
}
