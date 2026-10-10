"use client";

import { ambilLogo, keDataUrl, rgb, unduh } from "@/lib/ekspor-rekap";
import { namaBulan } from "@/lib/rekap-kantor";
import type { ItemPayrollBulanan, PayrollBulanan } from "@/types";

const TEAL = "19404F";
const KUNING = "FAD131";
const ABU = "ECEBE7";

const NAMA_STATUS: Record<string, string> = {
  DRAFT: "Draft",
  REVIEW: "Diperiksa",
  APPROVED: "Disetujui",
  PAID: "Dibayar",
  LOCKED: "Dikunci",
};

interface Kolom {
  judul: string;
  pendek: string;
  ambil: (i: ItemPayrollBulanan, n: number) => string | number;
  lebar: number;
  uang?: boolean;
  jumlah?: boolean;
}

const KOLOM: Kolom[] = [
  { judul: "No", pendek: "No", ambil: (_, n) => n + 1, lebar: 5 },
  { judul: "Kode", pendek: "Kode", ambil: (i) => i.employeeId, lebar: 11 },
  { judul: "Nama", pendek: "Nama", ambil: (i) => i.employeeName, lebar: 24 },
  { judul: "Divisi", pendek: "Divisi", ambil: (i) => i.divisi, lebar: 12 },
  { judul: "Rekening pembayar", pendek: "Rekening", ambil: (i) => i.rekeningPembayar || "", lebar: 16 },
  { judul: "Hadir / hari kerja", pendek: "Hadir", ambil: (i) => `${i.hadir}/${i.hariKerja}`, lebar: 9 },
  { judul: "Alpa", pendek: "Alpa", ambil: (i) => i.alpa, lebar: 6, jumlah: true },
  { judul: "Telat (kali)", pendek: "Telat", ambil: (i) => i.terlambatKali, lebar: 7, jumlah: true },
  { judul: "Gaji pokok", pendek: "Gaji pokok", ambil: (i) => i.gajiPokok, lebar: 13, uang: true, jumlah: true },
  { judul: "Tunjangan", pendek: "Tunjangan", ambil: (i) => i.totalTunjangan || 0, lebar: 12, uang: true, jumlah: true },
  { judul: "Bonus", pendek: "Bonus", ambil: (i) => i.bonus || 0, lebar: 11, uang: true, jumlah: true },
  { judul: "Lembur", pendek: "Lembur", ambil: (i) => i.lembur, lebar: 11, uang: true, jumlah: true },
  { judul: "Uang kerajinan", pendek: "Kerajinan", ambil: (i) => i.uangKerajinan, lebar: 11, uang: true, jumlah: true },
  { judul: "Tambahan lain", pendek: "Tambahan", ambil: (i) => i.tambahanLain, lebar: 11, uang: true, jumlah: true },
  { judul: "Kotor", pendek: "Kotor", ambil: (i) => i.kotor, lebar: 13, uang: true, jumlah: true },
  { judul: "Denda telat", pendek: "Denda", ambil: (i) => i.dendaTelat, lebar: 11, uang: true, jumlah: true },
  { judul: "Potongan alpa", pendek: "Pot. alpa", ambil: (i) => i.potonganAlpa, lebar: 11, uang: true, jumlah: true },
  { judul: "Potongan bon", pendek: "Pot. bon", ambil: (i) => i.potonganBon, lebar: 11, uang: true, jumlah: true },
  { judul: "BPJS Kesehatan", pendek: "BPJS Kes.", ambil: (i) => i.potonganBpjsKesehatan || 0, lebar: 11, uang: true, jumlah: true },
  { judul: "BPJS Ketenagakerjaan", pendek: "BPJS TK", ambil: (i) => i.potonganBpjsKetenagakerjaan ?? i.potonganBpjs ?? 0, lebar: 11, uang: true, jumlah: true },
  { judul: "Potongan BPJS", pendek: "BPJS", ambil: (i) => i.potonganBpjs || 0, lebar: 11, uang: true, jumlah: true },
  { judul: "Potongan lain", pendek: "Pot. lain", ambil: (i) => i.potonganLain, lebar: 11, uang: true, jumlah: true },
  { judul: "Total potongan", pendek: "Tot. potongan", ambil: (i) => i.totalPotongan, lebar: 13, uang: true, jumlah: true },
  { judul: "Diterima", pendek: "Diterima", ambil: (i) => i.bersih, lebar: 14, uang: true, jumlah: true },
];

const ribu = (n: number) => (n ? n.toLocaleString("id-ID") : "0");

function jumlah(items: ItemPayrollBulanan[], k: Kolom): number {
  return items.reduce((t, i, n) => t + Number(k.ambil(i, n) || 0), 0);
}

function keterangan(i: ItemPayrollBulanan): string {
  return [
    i.lemburKet && `Lembur: ${i.lemburKet}`,
    i.tambahanLainKet && `Tambahan: ${i.tambahanLainKet}`,
    i.potonganLainKet && `Potongan: ${i.potonganLainKet}`,
    i.catatan,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* ============================== EXCEL ============================== */

export async function eksporPayrollBulananExcel(opsi: {
  payroll: PayrollBulanan;
  items: ItemPayrollBulanan[];
  dibuatOleh: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Allegro Global Construction";
  wb.created = new Date();

  const ws = wb.addWorksheet("Daftar Gaji", {
    views: [{ state: "frozen", ySplit: 6, xSplit: 3 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const semua = [...KOLOM, { judul: "Keterangan", pendek: "", ambil: keterangan, lebar: 40 } as Kolom];
  // Tanpa "header": ExcelJS menulis header ke baris 1 dan merusak kop.
  ws.columns = semua.map((k) => ({ width: k.lebar + 2 }));
  const n = semua.length;

  const logo = await ambilLogo();
  if (logo) {
    const id = wb.addImage({ buffer: logo, extension: "png" });
    ws.addImage(id, { tl: { col: 0.2, row: 0.2 }, ext: { width: 50, height: 64 } });
  }
  const tulis = (baris: number, isi: string, font: Partial<import("exceljs").Font>) => {
    ws.mergeCells(baris, 3, baris, n);
    ws.getCell(baris, 3).value = isi;
    ws.getCell(baris, 3).font = font;
  };
  tulis(1, "PT ALLEGRO GLOBAL CONSTRUCTION", { size: 16, bold: true, color: { argb: `FF${TEAL}` } });
  tulis(2, "Daftar Gaji Bulanan Staf Kantor", { size: 12, bold: true });
  tulis(3, `Periode ${namaBulan(opsi.payroll.bulan)} · status ${NAMA_STATUS[opsi.payroll.status]}`, { size: 10 });
  tulis(4, `Dicetak ${new Date().toLocaleString("id-ID")} oleh ${opsi.dibuatOleh}`, {
    size: 9,
    italic: true,
    color: { argb: "FF61727A" },
  });
  ws.getRow(1).height = 22;
  ws.getRow(5).height = 8;

  const kepala = ws.getRow(6);
  semua.forEach((k, i) => {
    const sel = kepala.getCell(i + 1);
    sel.value = k.judul;
    sel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${TEAL}` } };
    sel.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  kepala.height = 30;

  opsi.items.forEach((item, urut) => {
    const row = ws.addRow(semua.map((k) => k.ambil(item, urut)));
    row.font = { size: 10 };
    semua.forEach((k, i) => {
      const sel = row.getCell(i + 1);
      if (k.uang) sel.numFmt = "#,##0";
      if (urut % 2 === 1) sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ABU}` } };
    });
    row.getCell(semua.length).alignment = { wrapText: true, vertical: "middle" };
    row.getCell(KOLOM.length).font = { size: 10, bold: true, color: { argb: item.bersih < 0 ? "FFB3261E" : `FF${TEAL}` } };
  });

  const total = ws.addRow(
    semua.map((k, i) => (i === 2 ? `JUMLAH · ${opsi.items.length} karyawan` : k.jumlah ? jumlah(opsi.items, k) : ""))
  );
  total.font = { size: 10, bold: true };
  total.eachCell((sel, kol) => {
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${KUNING}` } };
    if (semua[kol - 1]?.uang) sel.numFmt = "#,##0";
  });

  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: n } };

  const ttd = total.number + 3;
  [
    [3, "Dibuat oleh (HR)"],
    [9, "Diperiksa"],
    [15, "Disetujui (Owner)"],
  ].forEach(([kol, isi]) => {
    ws.getCell(ttd, kol as number).value = isi as string;
    ws.getCell(ttd, kol as number).font = { size: 10, bold: true };
    ws.getCell(ttd + 4, kol as number).border = { top: { style: "thin" } };
  });

  const isi = await wb.xlsx.writeBuffer();
  unduh(
    new Blob([isi], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Payroll-Bulanan-${opsi.payroll.bulan}.xlsx`
  );
}

/* =============================== PDF =============================== */

export async function eksporPayrollBulananPdf(opsi: {
  payroll: PayrollBulanan;
  items: ItemPayrollBulanan[];
  dibuatOleh: string;
}) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const lebar = doc.internal.pageSize.getWidth();
  const tinggi = doc.internal.pageSize.getHeight();
  const tepi = 8;
  const logo = await ambilLogo();

  if (logo) doc.addImage(keDataUrl(logo), "PNG", tepi, 8, 13, 16.7);
  const x = tepi + (logo ? 17 : 0);
  doc.setTextColor(...rgb(TEAL));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PT ALLEGRO GLOBAL CONSTRUCTION", x, 13);
  doc.setTextColor(27, 43, 51);
  doc.setFontSize(11);
  doc.text("Daftar Gaji Bulanan Staf Kantor", x, 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Periode ${namaBulan(opsi.payroll.bulan)} - status ${NAMA_STATUS[opsi.payroll.status]}`, x, 24);
  doc.setDrawColor(...rgb(KUNING));
  doc.setLineWidth(0.8);
  doc.line(tepi, 28, lebar - tepi, 28);

  const IDX_DITERIMA = KOLOM.length - 1;

  autoTable(doc, {
    startY: 32,
    margin: { left: tepi, right: tepi, bottom: 12 },
    head: [KOLOM.map((k) => k.pendek)],
    body: opsi.items.map((i, n) => KOLOM.map((k) => (k.uang ? ribu(Number(k.ambil(i, n))) : String(k.ambil(i, n))))),
    foot: [
      KOLOM.map((k, idx) =>
        idx === 2
          ? `JUMLAH - ${opsi.items.length} orang`
          : k.jumlah
          ? k.uang
            ? ribu(jumlah(opsi.items, k))
            : String(jumlah(opsi.items, k))
          : ""
      ),
    ],
    theme: "grid",
    styles: { fontSize: 6.2, cellPadding: 0.9, lineColor: [218, 216, 210], lineWidth: 0.1, valign: "middle" },
    headStyles: { fillColor: rgb(TEAL), textColor: 255, fontStyle: "bold", halign: "center", fontSize: 6.5 },
    footStyles: { fillColor: rgb(KUNING), textColor: rgb(TEAL), fontStyle: "bold", halign: "right" },
    alternateRowStyles: { fillColor: rgb(ABU) },
    columnStyles: {
      0: { halign: "center", cellWidth: 7 },
      1: { cellWidth: 15 },
      2: { cellWidth: 30 },
      3: { cellWidth: 14 },
      4: { halign: "center", cellWidth: 11 },
      5: { halign: "center", cellWidth: 8 },
      6: { halign: "center", cellWidth: 8 },
      ...Object.fromEntries(KOLOM.map((k, i) => [i, k.uang ? { halign: "right" as const } : {}]).filter(([i]) => Number(i) > 6)),
      [IDX_DITERIMA]: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === IDX_DITERIMA && opsi.items[d.row.index].bersih < 0) {
        d.cell.styles.textColor = rgb("B3261E");
      }
    },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  if (y + 28 > tinggi - 12) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(7.5);
  doc.setTextColor(97, 114, 122);
  doc.text(
    "Denda telat dihitung otomatis sesuai pengumuman 1 April 2025. Lembur, potongan alpa, uang kerajinan, dan komponen lain diisi manual. Rincian keterangan per orang ada di berkas Excel.",
    tepi,
    y,
    { maxWidth: lebar - tepi * 2 }
  );
  y += 9;
  doc.setTextColor(27, 43, 51);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  [
    [tepi + 20, "Dibuat oleh (HR)"],
    [lebar / 2 - 20, "Diperiksa"],
    [lebar - tepi - 60, "Disetujui (Owner)"],
  ].forEach(([px, t]) => {
    doc.text(String(t), Number(px), y);
    doc.setLineWidth(0.2);
    doc.line(Number(px), y + 18, Number(px) + 45, y + 18);
  });

  const halaman = doc.getNumberOfPages();
  for (let i = 1; i <= halaman; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(97, 114, 122);
    doc.text(`Dicetak ${new Date().toLocaleString("id-ID")} oleh ${opsi.dibuatOleh} - RAHASIA`, tepi, tinggi - 5);
    doc.text(`Halaman ${i} dari ${halaman}`, lebar - tepi, tinggi - 5, { align: "right" });
  }

  doc.save(`Payroll-Bulanan-${opsi.payroll.bulan}.pdf`);
}
