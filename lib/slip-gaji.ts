"use client";

import { ALAMAT_PERUSAHAAN, PENANDATANGAN_SLIP, STATUS_KEPEGAWAIAN } from "@/lib/constants";
import { ambilLogo, keDataUrl, rgb } from "@/lib/ekspor-rekap";
import { namaBulan } from "@/lib/rekap-kantor";
import { terbilang } from "@/lib/terbilang";
import type { LampiranSlip, RentangTanggal } from "@/lib/slip-harian";
import type { Employee, ItemPayrollBulanan, SlipGaji } from "@/types";

/*
 * SLIP GAJI - mengikuti form manual perusahaan (slip_gaji.xlsx):
 *
 *   Halaman 1  FORM 1 (1-2)  Absensi harian sebulan + total + tanda tangan
 *                            Admin Proyek dan Project Manager.
 *   Halaman 2  FORM 1 (2-2)  Rincian gaji, data keterlambatan/izin/cuti/
 *                            sakit/alpa, data kasbon, SP, tanda tangan
 *                            Staff Keuangan dan Direktur Keuangan.
 *
 * Komponen yang belum ada di sistem (tunjangan jabatan, uang makan,
 * transport, bonus, tempat tinggal, pulsa, luar kota) tetap dicetak
 * barisnya dengan tanda "-" supaya bentuknya sama dengan form lama.
 *
 * Slip dari payroll yang belum Dibayar diberi cap DRAF tembus pandang.
 */

const TEAL = "19404F";
const MERAH: [number, number, number] = [200, 30, 30];
const TINTA: [number, number, number] = [20, 20, 20];
const REDUP: [number, number, number] = [110, 110, 110];
const BIRU_MUDA: [number, number, number] = [201, 214, 238];
const KUNING_TUA: [number, number, number] = [250, 190, 0];
const KREM: [number, number, number] = [255, 242, 204];

type DataSlip = Omit<SlipGaji, "createdAt">;
type JsPDF = import("jspdf").jsPDF;

export function samarkanRekening(nomor: string | undefined | null): string {
  const angka = String(nomor || "").replace(/\D/g, "");
  if (!angka) return "-";
  if (angka.length < 5) return "••••";
  return `•••• ${angka.slice(-4)}`;
}

export interface TambahanSlip {
  lampiran?: LampiranSlip;
  sisaCuti?: number | null;
  sisaSakit?: number | null;
  kasbon?: SlipGaji["kasbon"];
  sp?: SlipGaji["sp"];
}

export function keSlip(
  item: ItemPayrollBulanan,
  karyawan: Employee | undefined,
  oleh: string,
  tambahan: TambahanSlip = {}
): DataSlip {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, payrollId, createdAt: _c, updatedAt: _u, ...isi } = item;
  const status = STATUS_KEPEGAWAIAN.find((s) => s.nilai === karyawan?.statusKepegawaian)?.label || "";
  return {
    ...isi,
    id: `${payrollId}__${item.employeeId}`,
    bulan: payrollId,
    bankName: karyawan?.bankName || "",
    rekeningSamar: samarkanRekening(karyawan?.bankAccountNumber),
    diterbitkanOleh: oleh,
    jabatan: karyawan?.position === "PIC" ? "PIC Proyek" : karyawan?.position === "STAF" ? "Staf" : karyawan?.position || "",
    statusKepegawaian: status,
    lampiran: tambahan.lampiran ?? null,
    sisaCuti: tambahan.sisaCuti ?? null,
    sisaSakit: tambahan.sisaSakit ?? null,
    kasbon: tambahan.kasbon || [],
    sp: tambahan.sp || [],
  };
}

const ribu = (n: number) => (n ? Math.round(n).toLocaleString("id-ID") : "-");
const tglPendek = (t: string) => {
  const [, m, d] = t.split("-").map(Number);
  const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${d} ${BLN[m - 1]}`;
};
const teksRentang = (r: RentangTanggal) => (r.hari === 1 ? tglPendek(r.dari) : `${tglPendek(r.dari)} - ${tglPendek(r.sampai)}`);

/* ------------------------------ kop ------------------------------ */

function kop(doc: JsPDF, s: DataSlip, logoUrl: string | null, form: string, judulKanan: string, y0: number) {
  const L = doc.internal.pageSize.getWidth();

  // Identitas kiri
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA);
  const id: [string, string][] = [
    ["Nama", s.employeeName],
    ["Divisi", s.divisi || "-"],
    ["Jabatan", s.jabatan || "-"],
    ["Status", s.statusKepegawaian || "-"],
  ];
  id.forEach(([l, v], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${l} :`, 36, y0 + 5 + i * 4.8, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(v, 38, y0 + 5 + i * 4.8, { maxWidth: 42 });
  });

  // Logo dan alamat di tengah
  if (logoUrl) doc.addImage(logoUrl, "PNG", 84, y0, 17, 22);
  doc.setFontSize(6.5);
  doc.setTextColor(...REDUP);
  ALAMAT_PERUSAHAAN.forEach((b, i) => doc.text(b, 104, y0 + 9 + i * 4.2));

  // Kotak form kanan atas
  doc.setDrawColor(...TINTA);
  doc.setLineWidth(0.25);
  doc.rect(L - 42, y0 - 4, 30, 5);
  doc.rect(L - 42, y0 + 1, 30, 5);
  doc.setFontSize(7.5);
  doc.setTextColor(...TINTA);
  doc.text(form, L - 27, y0 - 0.5, { align: "center" });
  doc.text("SLIP GAJI", L - 27, y0 + 4.5, { align: "center" });
  if (judulKanan) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(judulKanan, L - 12, y0 + 18, { align: "right" });
    doc.setFont("helvetica", "normal");
  }
}

function tandaTangan(doc: JsPDF, x: number, y: number, judul: string, orang: { nama: string; jabatan: string }) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA);
  doc.text(judul, x + 25, y, { align: "center" });
  doc.text(orang.nama, x + 25, y + 18, { align: "center" });
  doc.setLineWidth(0.25);
  doc.line(x, y + 19.5, x + 50, y + 19.5);
  doc.text(orang.jabatan, x + 25, y + 23.5, { align: "center" });
}

function capDraf(doc: JsPDF) {
  const L = doc.internal.pageSize.getWidth();
  const T = doc.internal.pageSize.getHeight();
  const d = doc as unknown as { GState: new (o: { opacity: number }) => unknown; setGState: (g: unknown) => void };
  doc.setTextColor(214, 60, 50);
  doc.setFont("helvetica", "bold");
  d.setGState(new d.GState({ opacity: 0.13 }));
  doc.setFontSize(110);
  doc.text("DRAF", L / 2, T / 2 + 20, { align: "center", angle: 30 });
  d.setGState(new d.GState({ opacity: 1 }));
  doc.setFontSize(9);
  doc.text("DRAF - BELUM DIBAYAR, BUKAN SLIP RESMI", L / 2, 8, { align: "center" });
  doc.setFont("helvetica", "normal");
}

/* ------------------------ halaman 1: absensi ------------------------ */

type AutoTable = (doc: JsPDF, opsi: Record<string, unknown>) => void;

function halamanAbsensi(doc: JsPDF, s: DataSlip, logoUrl: string | null, autoTable: AutoTable) {
  const L = doc.internal.pageSize.getWidth();
  const periode = namaBulan(s.bulan).toUpperCase();
  kop(doc, s, logoUrl, "FORM 1 (1-2)", `ABSENSI PER ${periode}`, 14);

  const lamp = s.lampiran;
  if (!lamp) {
    doc.setFontSize(9);
    doc.text("Karyawan ini tidak wajib absen, jadi tidak ada lampiran absensi harian.", 14, 50);
    return;
  }

  autoTable(doc, {
    startY: 42,
    margin: { left: 14, right: 14 },
    head: [
      [{ content: `ABSENSI PER ${periode}`, colSpan: 7, styles: { halign: "center", fillColor: BIRU_MUDA } }],
      ["No.", "Hari", "Tgl", "Datang", "Pulang", "Lembur", "Keterangan"],
    ],
    body: lamp.harian.map((h, i) => [String(i + 1), h.hari, tglPendek(h.tanggal), h.datang || "", h.pulang || "", "-", h.keterangan]),
    theme: "grid",
    styles: { fontSize: 6.8, cellPadding: 0.75, lineColor: [60, 60, 60], lineWidth: 0.15, textColor: TINTA, valign: "middle" },
    headStyles: { fillColor: [255, 255, 255], textColor: TINTA, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 16 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 14, halign: "center" },
    },
    didParseCell: (d: { section: string; row: { index: number }; cell: { styles: Record<string, unknown> } }) => {
      if (d.section === "body" && lamp.harian[d.row.index]?.merah) {
        d.cell.styles.textColor = MERAH;
        d.cell.styles.fontStyle = "bold";
      }
    },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const r = lamp.ringkas;
  const total: [string, number, boolean][] = [
    ["TOTAL HARI KALENDER", r.kalender, false],
    ["TOTAL HARI KERJA", r.hariKerja, false],
    ["TOTAL LIBUR TANGGAL MERAH", r.liburMerah, true],
    ["TOTAL LIBUR HARI MINGGU", r.liburMinggu, true],
    ["TOTAL MASUK KERJA", r.masuk, false],
    ["TOTAL CUTI", r.cuti, false],
    ["TOTAL IZIN", r.izin, false],
    ["TOTAL SAKIT", r.sakit, false],
    ["TOTAL ALPHA", r.alpa, false],
  ];
  doc.setFontSize(8);
  total.forEach(([l, n, merah], i) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(merah ? MERAH : TINTA));
    doc.text(`${l}  =`, 100, y + i * 4.6, { align: "right" });
    doc.text(String(n), 108, y + i * 4.6, { align: "center" });
    doc.text("Hari", 114, y + i * 4.6);
  });
  doc.setFont("helvetica", "normal");

  tandaTangan(doc, L - 70, y, "Dibuat oleh,", PENANDATANGAN_SLIP.absensiDibuat);
  tandaTangan(doc, L - 70, y + 32, "Mengetahui,", PENANDATANGAN_SLIP.absensiMengetahui);
}

/* -------------------------- halaman 2: gaji -------------------------- */

function halamanGaji(doc: JsPDF, s: DataSlip, logoUrl: string | null, autoTable: AutoTable) {
  const L = doc.internal.pageSize.getWidth();
  const periode = namaBulan(s.bulan).toUpperCase();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...TINTA);
  doc.text("SLIP GAJI KARYAWAN", L / 2, 12, { align: "center" });
  doc.setFontSize(9.5);
  doc.text(`PER ${periode}`, L / 2, 17, { align: "center" });
  kop(doc, s, logoUrl, "FORM 1 (2-2)", "", 24);

  // ---- rincian gaji: label = qty x Rp. tarif /satuan = Rp. jumlah ----
  let y = 54;
  const xLabel = 78, xQty = 88, xRp = 96, xTarif = 124, xSat = 126, xRp2 = 146, xJml = 176;
  doc.setFontSize(8.5);

  const barisGaji = (label: string, qty: string, tarif: string, satuan: string, jumlah: string, merah = false, tebal = true) => {
    doc.setTextColor(...(merah ? MERAH : TINTA));
    doc.setFont("helvetica", tebal ? "bold" : "normal");
    doc.text(`${label} =`, xLabel, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    if (qty) {
      doc.text(qty, xQty, y, { align: "right" });
      doc.text("x  Rp.", xRp - 5, y);
      doc.text(tarif, xTarif, y, { align: "right" });
      doc.text(satuan, xSat, y);
    }
    doc.text("=  Rp.", xRp2 - 5, y);
    doc.text(jumlah, xJml, y, { align: "right" });
    y += 4.6;
  };

  barisGaji("Gaji Pokok", "1", ribu(s.gajiPokok), "/bln", ribu(s.gajiPokok));
  barisGaji("Lembur", s.lemburKet ? "" : "-", "", "", ribu(s.lembur));
  if (s.lemburKet) {
    doc.setFontSize(7);
    doc.setTextColor(...REDUP);
    doc.text(`(${s.lemburKet})`, xQty - 8, y - 4.6);
    doc.setFontSize(8.5);
  }
  barisGaji("Luar Kota", "", "", "", "-");
  doc.setFontSize(7);
  doc.setTextColor(...REDUP);
  doc.text("(lewat reimburse proyek)", xQty - 8, y - 4.6);
  doc.setFontSize(8.5);

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TINTA);
  doc.text("TUNJANGAN", 40, y);
  doc.setLineWidth(0.2);
  doc.line(40, y + 0.8, 40 + doc.getTextWidth("TUNJANGAN"), y + 0.8);
  y += 5;
  doc.setFont("helvetica", "normal");
  const tanpa = (l: string, satuan: string) => barisGaji(l, "-", "", satuan, "-", false, false);
  // Jenis tunjangan diatur di aplikasi. Yang tidak didapat tetap dicetak "-"
  // supaya bentuknya sama dengan form lama. Kalau belum ada yang diatur,
  // dicetak daftar dari form lama.
  const tunjangan = s.tunjangan?.length
    ? s.tunjangan
    : [
        ["Tunjangan Jabatan", "BULAN"],
        ["Uang Makan", "HARI"],
        ["Uang Transport", "HARI"],
        ["Tunjangan Tempat Tinggal", "BULAN"],
        ["Uang Pulsa", "BULAN"],
      ].map(([nama, satuan]) => ({ jenisId: nama, nama, satuan: satuan as "BULAN" | "HARI", tarif: 0, jumlahSatuan: 0, total: 0 }));
  tunjangan.forEach((t) => {
    const sat = t.satuan === "HARI" ? "/hari" : "/bln";
    if (t.total) barisGaji(t.nama.slice(0, 30), String(t.jumlahSatuan), ribu(t.tarif), sat, ribu(t.total), false, false);
    else tanpa(t.nama.slice(0, 30), sat);
  });
  barisGaji("Bonus Bulanan", "", "", "", ribu(s.bonus || 0), false, false);
  if (s.uangKerajinan) barisGaji("Uang Rajin", "1", ribu(s.uangKerajinan), "/bln", ribu(s.uangKerajinan), false, false);
  else tanpa("Uang Rajin", "/bln");
  doc.setFontSize(7.5);
  doc.setTextColor(...TINTA);
  doc.text("(jika masuk full selama sebulan)", 26, y);
  doc.setFontSize(8.5);
  y += 4.6;
  if (s.tambahanLain) {
    barisGaji(`Tambahan lain${s.tambahanLainKet ? ` (${s.tambahanLainKet})` : ""}`.slice(0, 40), "", "", "", ribu(s.tambahanLain), false, false);
  }

  // Garis dan TOTAL
  doc.setLineWidth(0.3);
  doc.setDrawColor(...TINTA);
  doc.line(xRp2 - 5, y - 2.5, xJml + 2, y - 2.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TINTA);
  doc.text("TOTAL", 128, y + 1, { align: "right" });
  doc.text("=  Rp.", xRp2 - 5, y + 1);
  doc.text(ribu(s.kotor), xJml, y + 1, { align: "right" });
  y += 7;

  barisGaji("Potongan Kasbon", "", "", "", ribu(s.potonganBon), true);
  barisGaji("Potongan Telat", "", "", "", ribu(s.dendaTelat), true);
  if (s.potonganAlpa) barisGaji("Potongan Alpa", "", "", "", ribu(s.potonganAlpa), true);
  if (s.potonganBpjs) barisGaji("Potongan BPJS", "", "", "", ribu(s.potonganBpjs), true);
  if (s.potonganLain) {
    barisGaji(`Potongan Lain${s.potonganLainKet ? ` (${s.potonganLainKet})` : ""}`.slice(0, 40), "", "", "", ribu(s.potonganLain), true);
  }

  // JUMLAH YANG DI TRANSFER
  y += 3;
  doc.setLineWidth(0.4);
  doc.rect(78, y - 4.5, 104, 7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TINTA);
  doc.text("JUMLAH YANG DI TRANSFER", 128, y, { align: "right" });
  doc.text("=  Rp.", xRp2 - 5, y);
  doc.text(Math.round(s.bersih).toLocaleString("id-ID"), xJml, y, { align: "right" });
  y += 5.5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  const kata = terbilang(s.bersih);
  doc.text(`Terbilang: ${kata.charAt(0).toUpperCase()}${kata.slice(1)}`, 182, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 2;
  doc.setFontSize(7.5);
  doc.setTextColor(...REDUP);
  doc.text(`Ditransfer ke ${s.bankName ? `${s.bankName} ` : ""}${s.rekeningSamar}`, 182, y + 3.5, { align: "right" });

  // ---- DATA KETERLAMBATAN, IJIN, SAKIT, CUTI & ALPA ----
  y += 7;
  const lamp = s.lampiran;
  const kiriIsi = (daftar: string[], n: number) => Array.from({ length: n }, (_, i) => daftar[i] || "");
  const telat = (lamp?.telat || []).map((t) => `${tglPendek(t.tanggal)} (${t.menit} mnt)`);
  const izin = (lamp?.izin || []).map((r) => `${teksRentang(r)} = ${r.hari} hari`);
  const cuti = (lamp?.cuti || []).map((r) => `${teksRentang(r)} = ${r.hari} hari`);
  const sakit = (lamp?.sakit || []).map((r) => `${teksRentang(r)} = ${r.hari} hari`);
  const alpa = (lamp?.alpa || []).map((r) => `${teksRentang(r)} = ${r.hari} hari`);

  const nTelat = Math.max(4, Math.ceil(telat.length / 2));
  const telatKiri = kiriIsi(telat.slice(0, nTelat), nTelat);
  const telatKanan = kiriIsi(telat.slice(nTelat), nTelat);
  const nIzin = Math.max(nTelat, izin.length);
  const nCuti = Math.max(4, cuti.length, sakit.length);
  const nAlpa = Math.max(3, alpa.length);

  const judul = (t: string) => ({ content: t, colSpan: 2, styles: { halign: "center", fillColor: KREM, fontStyle: "bold" } });
  const total = (t: string) => ({ content: t, styles: { halign: "right", fontStyle: "bold" } });

  const body: unknown[][] = [
    [judul("KETERLAMBATAN"), judul("IJIN")],
    ...Array.from({ length: Math.max(nTelat, nIzin) }, (_, i) => [
      telatKiri[i] ? `Tgl. : ${telatKiri[i]}` : "Tgl. :",
      telatKanan[i] ? `Tgl. : ${telatKanan[i]}` : "Tgl. :",
      izin[i] ? `Tgl. : ${izin[i]}` : "Tgl. :",
      "",
    ]),
    [total(`TOTAL KETERLAMBATAN = ${s.terlambatKali} kali`), "", total(`TOTAL IJIN = ${lamp?.ringkas.izin ?? s.izin} hari`), ""],
    [judul("CUTI"), judul("SAKIT (JATAH SAKIT 6X)")],
    ...Array.from({ length: nCuti }, (_, i) => [cuti[i] ? `Tgl. : ${cuti[i]}` : "Tgl. :", "", sakit[i] ? `Tgl. : ${sakit[i]}` : "Tgl. :", ""]),
    [total(`TOTAL CUTI = ${s.cuti} hari`), "", total(`TOTAL SAKIT = ${s.sakit} hari`), ""],
    [
      total(`SISA CUTI = ${s.sisaCuti ?? "-"} hari`),
      "",
      total(`SISA JATAH SAKIT = ${s.sisaSakit ?? "-"} hari`),
      "",
    ],
    [judul("ALPA"), { content: "", colSpan: 2, styles: { lineWidth: 0 } }],
    ...Array.from({ length: nAlpa }, (_, i) => [alpa[i] ? `Tgl. : ${alpa[i]}` : "Tgl. :", "", "", ""]),
    [total(`TOTAL ALPA = ${s.alpa} hari`), "", "", ""],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [[{ content: "DATA KETERLAMBATAN, IJIN, SAKIT, CUTI & ALPA", colSpan: 4, styles: { halign: "center", fillColor: KUNING_TUA, textColor: TINTA } }]],
    body,
    theme: "plain",
    styles: { fontSize: 7, cellPadding: 0.6, textColor: TINTA },
    headStyles: { fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 45 }, 2: { cellWidth: 60 }, 3: { cellWidth: 31 } },
    tableLineColor: TINTA,
    tableLineWidth: 0.3,
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  const yBawah = y;

  // ---- DATA KASBON ----
  const kasbon = (s.kasbon || []).slice(-5);
  autoTable(doc, {
    startY: y,
    margin: { left: 14 },
    tableWidth: 82,
    head: [
      [{ content: "DATA KASBON", colSpan: 3, styles: { halign: "center", fillColor: BIRU_MUDA, textColor: MERAH } }],
      ["Tanggal", "DEBET", "KREDIT"],
    ],
    body: Array.from({ length: Math.max(5, kasbon.length) }, (_, i) => {
      const k = kasbon[i];
      return k ? [tglPendek(k.tanggal), k.debet ? `Rp. ${ribu(k.debet)}` : "", k.kredit ? `Rp. ${ribu(k.kredit)}` : ""] : ["", "Rp.", "Rp."];
    }),
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 0.7, lineColor: [60, 60, 60], lineWidth: 0.15, textColor: TINTA },
    headStyles: { fillColor: [255, 255, 255], textColor: TINTA, fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { cellWidth: 22 }, 1: { textColor: [30, 90, 200] }, 2: { textColor: MERAH } },
  });

  // ---- SP ----
  const yKasbon = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  const tglSp = (n: number) => {
    const sp = (s.sp || []).find((x) => x.tingkat === n);
    return sp ? tglPendek(sp.tanggal) : "-";
  };
  autoTable(doc, {
    startY: yKasbon,
    margin: { left: 14 },
    tableWidth: 82,
    head: [["", "SP 1", "SP 2", "SP 3"]],
    body: [["Tanggal", tglSp(1), tglSp(2), tglSp(3)]],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 0.8, halign: "center", lineColor: [60, 60, 60], lineWidth: 0.15, textColor: TINTA },
    headStyles: { fillColor: BIRU_MUDA, textColor: [30, 90, 200], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 22, fontStyle: "bold", textColor: MERAH, fillColor: [230, 184, 183] } },
  });

  tandaTangan(doc, L - 70, yBawah + 2, "Dibayarkan oleh,", PENANDATANGAN_SLIP.gajiDibayarkan);
  tandaTangan(doc, L - 70, yBawah + 32, "Mengetahui,", PENANDATANGAN_SLIP.gajiMengetahui);

  if (s.capaiSp) {
    doc.setFontSize(7.5);
    doc.setTextColor(...MERAH);
    doc.text("Skor keterlambatan bulan ini mencapai 100 (batas SP 1).", 14, doc.internal.pageSize.getHeight() - 8);
  }
  doc.setFontSize(6.5);
  doc.setTextColor(...rgb(TEAL));
  doc.text("Rahasia - hanya untuk karyawan yang bersangkutan.", L / 2, doc.internal.pageSize.getHeight() - 4, {
    align: "center",
  });
}

/** Satu PDF berisi satu atau banyak slip; tiap slip dua halaman. */
export async function unduhSlipPdf(opsi: { slip: DataSlip[]; namaBerkas: string; draf: boolean }) {
  if (!opsi.slip.length) throw new Error("Tidak ada slip untuk diunduh.");
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default as unknown as AutoTable;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await ambilLogo();
  const logoUrl = logo ? keDataUrl(logo) : null;

  opsi.slip.forEach((s, i) => {
    if (i > 0) doc.addPage();
    halamanAbsensi(doc, s, logoUrl, autoTable);
    if (opsi.draf) capDraf(doc);
    doc.addPage();
    halamanGaji(doc, s, logoUrl, autoTable);
    if (opsi.draf) capDraf(doc);
  });

  doc.setProperties({ title: opsi.namaBerkas, author: "PT Allegro Global Construction" });
  doc.save(opsi.namaBerkas);
}

export function namaBerkasSlip(bulan: string, kode?: string) {
  return kode ? `Slip-Gaji-${bulan}-${kode}.pdf` : `Slip-Gaji-${bulan}-semua.pdf`;
}
