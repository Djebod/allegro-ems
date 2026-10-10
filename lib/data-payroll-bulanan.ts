"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { dbClient } from "@/lib/firebase";
import { keTanggal, tanggalHariIni } from "@/lib/absensi";
import { bonBerjalan, catatPembayaranBon } from "@/lib/data";
import { ambilBahanRekap } from "@/lib/data-rekap";
import { barisTanpaAbsen, hitungRekap } from "@/lib/rekap-kantor";
import {
  KOLOM_MANUAL,
  gajiUntukBulan,
  hariKerjaBulan,
  hitungAngka,
  jumlahkanBulanan,
  susunItemBulanan,
  type IsianLama,
  type IsianManual,
  type ItemBaru,
} from "@/lib/payroll-bulanan";
import { totalJamLemburDisetujui } from "@/lib/lembur";
import { keSlip } from "@/lib/slip-gaji";
import { susunLampiranSlip } from "@/lib/slip-harian";
import type {
  EmployeeLoan,
  GajiBulanan,
  JenisTunjangan,
  SatuanTunjangan,
  ItemPayrollBulanan,
  LoanRepayment,
  PayrollBulanan,
  SaldoCuti,
  SlipGaji,
  StatusPayroll,
  SuratPeringatan,
} from "@/types";

/* ========================= Jenis tunjangan ========================== */

export function pantauJenisTunjangan(setData: (d: JenisTunjangan[]) => void, gagal: () => void) {
  return onSnapshot(
    collection(dbClient(), "jenisTunjangan"),
    (snap) =>
      setData(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<JenisTunjangan, "id">) }))
          .sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama))
      ),
    gagal
  );
}

/** Menambah atau mengubah jenis tunjangan. Tidak pernah dihapus, cukup dinonaktifkan. */
export async function simpanJenisTunjangan(opsi: {
  id?: string;
  nama: string;
  satuan: SatuanTunjangan;
  urutan: number;
  aktif: boolean;
}) {
  const nama = opsi.nama.trim();
  if (!nama) throw new Error("Nama tunjangan wajib diisi.");
  const db = dbClient();
  const data = { nama, satuan: opsi.satuan, urutan: Math.round(opsi.urutan) || 0, aktif: opsi.aktif, updatedAt: serverTimestamp() };
  if (opsi.id) await updateDoc(doc(db, "jenisTunjangan", opsi.id), data);
  else {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "jenisTunjangan")), { ...data, createdAt: serverTimestamp() });
    await batch.commit();
  }
}

/** Isi awal sesuai form slip lama perusahaan. Hanya dipakai bila daftar masih kosong. */
export async function isiJenisTunjanganBawaan() {
  const db = dbClient();
  const batch = writeBatch(db);
  [
    ["Tunjangan Jabatan", "BULAN"],
    ["Uang Makan", "HARI"],
    ["Uang Transport", "HARI"],
    ["Tunjangan Tempat Tinggal", "BULAN"],
    ["Uang Pulsa", "BULAN"],
  ].forEach(([nama, satuan], i) =>
    batch.set(doc(collection(db, "jenisTunjangan")), {
      nama,
      satuan,
      urutan: i + 1,
      aktif: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  await batch.commit();
}

/* ============================ Gaji pokok ============================ */

export function pantauGajiBulanan(
  setData: (d: GajiBulanan[]) => void,
  gagal: () => void
) {
  return onSnapshot(
    collection(dbClient(), "gajiBulanan"),
    (snap) => setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GajiBulanan, "id">) }))),
    gagal
  );
}

/** "2026-09" -> "2026-08" */
export function bulanSebelum(bulan: string): string {
  const [t, b] = bulan.split("-").map(Number);
  const d = new Date(t, b - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Memasang gaji pokok baru. Gaji yang sedang berlaku ditutup sampai bulan
 * sebelumnya, lalu yang baru dibuat - dalam satu batch, supaya tidak ada
 * keadaan di mana seseorang punya dua gaji berlaku atau tidak punya sama
 * sekali.
 */
export async function pasangGajiBaru(opsi: {
  employeeId: string;
  gajiPokok: number;
  /** Nominal per jenis tunjangan. Yang nol tidak disimpan. */
  tunjangan?: Record<string, number>;
  berlakuMulai: string;
  catatan: string;
  semua: GajiBulanan[];
  oleh: string;
}) {
  const gaji = Math.round(opsi.gajiPokok);
  if (!(gaji > 0)) throw new Error("Gaji pokok harus lebih dari nol.");
  if (!/^\d{4}-\d{2}$/.test(opsi.berlakuMulai)) throw new Error("Bulan mulai berlaku belum dipilih.");

  const berjalan = opsi.semua.find((g) => g.employeeId === opsi.employeeId && g.berlakuSampai === null);
  // Bulan yang sama boleh: dianggap membetulkan isian. Catatan lama ditutup
  // sebelum masa berlakunya, sehingga tidak pernah terpakai lagi, tetapi
  // tetap tersimpan sebagai jejak.
  if (berjalan && opsi.berlakuMulai < berjalan.berlakuMulai) {
    throw new Error(
      `Gaji yang sekarang berlaku mulai ${berjalan.berlakuMulai}. Gaji baru tidak boleh berlaku sebelum bulan itu.`
    );
  }
  const tunjangan: Record<string, number> = {};
  Object.entries(opsi.tunjangan || {}).forEach(([k, v]) => {
    const n = Math.round(Number(v) || 0);
    if (n > 0) tunjangan[k] = n;
  });

  const db = dbClient();
  const batch = writeBatch(db);
  if (berjalan) {
    batch.update(doc(db, "gajiBulanan", berjalan.id), { berlakuSampai: bulanSebelum(opsi.berlakuMulai) });
  }
  batch.set(doc(collection(db, "gajiBulanan")), {
    employeeId: opsi.employeeId,
    gajiPokok: gaji,
    tunjangan,
    berlakuMulai: opsi.berlakuMulai,
    berlakuSampai: null,
    catatan: opsi.catatan.trim(),
    dibuatOleh: opsi.oleh,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

/* ========================= Payroll bulanan ========================== */

export function pantauDaftarPayrollBulanan(
  setData: (d: PayrollBulanan[]) => void,
  gagal: () => void
) {
  return onSnapshot(
    collection(dbClient(), "payrollBulanan"),
    (snap) =>
      setData(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PayrollBulanan, "id">) }))
          .sort((a, b) => b.bulan.localeCompare(a.bulan))
      ),
    gagal
  );
}

export function pantauPayrollBulanan(
  bulan: string,
  setData: (d: PayrollBulanan | null) => void,
  gagal: () => void
) {
  return onSnapshot(
    doc(dbClient(), "payrollBulanan", bulan),
    (snap) => setData(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<PayrollBulanan, "id">) } : null),
    gagal
  );
}

export function pantauItemBulanan(
  bulan: string,
  setData: (d: ItemPayrollBulanan[]) => void,
  gagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "payrollBulananItems"), where("payrollId", "==", bulan)),
    (snap) =>
      setData(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ItemPayrollBulanan, "id">) }))
          .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "id"))
      ),
    gagal
  );
}

/**
 * Menyusun seluruh baris payroll sebulan dari rekap absensi kantor,
 * gaji pokok, dan bon berjalan. Dipakai bersama oleh "hitung baru" dan
 * "hitung ulang", supaya keduanya mustahil memakai aturan berbeda.
 */
async function susunSemua(bulan: string, lama: Map<string, IsianLama> = new Map()) {
  const [bahan, gajiSnap, bon, jenisSnap] = await Promise.all([
    ambilBahanRekap(bulan),
    getDocs(collection(dbClient(), "gajiBulanan")),
    bonBerjalan(),
    getDocs(collection(dbClient(), "jenisTunjangan")).catch(() => null),
  ]);
  const gaji = gajiSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GajiBulanan, "id">) }));
  const jenisTunjangan = (jenisSnap?.docs || []).map((d) => ({ id: d.id, ...(d.data() as Omit<JenisTunjangan, "id">) }));
  const rekap = hitungRekap({ bulan, hariIni: tanggalHariIni(), ...bahan });

  // Direksi yang tidak wajib absen tetap digaji kalau gaji pokoknya ada.
  const tanpaAbsen = bahan.karyawan
    .filter((e) => e.tidakWajibAbsen && e.status === "ACTIVE" && gajiUntukBulan(gaji, e.id, bulan))
    .map(barisTanpaAbsen);

  // Pembagi upah sehari: hari kerja sebulan penuh, sama untuk semua orang.
  const hariKerjaSebulan = hariKerjaBulan(bulan, bahan.libur);

  const items = [...rekap.baris, ...tanpaAbsen].map((r) => {
    const karyawan = bahan.karyawan.find((e) => e.id === r.employeeId);
    return susunItemBulanan({
      bulan,
      rekap: r,
      gaji: gajiUntukBulan(gaji, r.employeeId, bulan),
      bon: bon.find((b) => b.employeeId === r.employeeId),
      jenisTunjangan,
      iuranBpjs: karyawan?.iuranBpjs,
      iuranBpjsKesehatan: karyawan?.iuranBpjsKesehatan,
      iuranBpjsKetenagakerjaan: karyawan?.iuranBpjsKetenagakerjaan,
      rekeningPembayar: karyawan?.rekeningPembayar,
      hariKerjaBulan: hariKerjaSebulan,
      // `masukLibur` berisi semua overtimeRequests bulan itu; yang jenis
      // LEMBUR dan DISETUJUI disaring di totalJamLemburDisetujui.
      jamLembur: totalJamLemburDisetujui(bahan.masukLibur, r.employeeId),
      tanpaLembur: !!karyawan?.tanpaLembur,
      lama: lama.get(r.employeeId),
    });
  });
  return items;
}

function idItem(bulan: string, employeeId: string) {
  return `${bulan}__${employeeId}`;
}

export async function buatPayrollBulanan(bulan: string, oleh: string) {
  const db = dbClient();
  const ref = doc(db, "payrollBulanan", bulan);
  if ((await getDoc(ref)).exists()) {
    throw new Error("Payroll bulan ini sudah pernah dibuat. Buka payroll yang ada, atau hitung ulang dari sana.");
  }

  const items = await susunSemua(bulan);
  if (items.length === 0) throw new Error("Belum ada staf kantor yang bisa dihitung untuk bulan ini.");

  const batch = writeBatch(db);
  batch.set(ref, {
    bulan,
    status: "DRAFT" as StatusPayroll,
    bonDiproses: false,
    dibuatOleh: oleh,
    disetujuiOleh: null,
    ...jumlahkanBulanan(items),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  items.forEach((i) =>
    batch.set(doc(db, "payrollBulananItems", idItem(bulan, i.employeeId)), {
      ...i,
      payrollId: bulan,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  await batch.commit();
  return items.length;
}

/**
 * Menghitung ulang dari absensi dan gaji terbaru. Hanya untuk DRAFT.
 * Isian manual (lembur, potongan alpa, uang kerajinan, dan lainnya)
 * dibawa ke hasil baru, jadi tidak perlu diketik ulang.
 */
export async function hitungUlangBulanan(p: PayrollBulanan, sekarang: ItemPayrollBulanan[]) {
  if (p.status !== "DRAFT") throw new Error("Hanya payroll berstatus DRAFT yang bisa dihitung ulang.");

  const lama = new Map<string, IsianLama>();
  sekarang.forEach((i) => {
    const isian: IsianLama = {};
    KOLOM_MANUAL.forEach((k) => ((isian as Record<string, unknown>)[k] = i[k]));
    // Penanda angka otomatis ikut dibawa supaya hitung ulang tahu mana
    // isian yang sudah dikoreksi HR dan mana yang boleh diperbarui.
    isian.lemburOtomatis = i.lemburOtomatis;
    isian.potonganAlpaOtomatis = i.potonganAlpaOtomatis;
    lama.set(i.employeeId, isian);
  });

  const items = await susunSemua(p.bulan, lama);
  const db = dbClient();

  // Dihapus dulu baru dibuat: angka salinan tidak boleh diubah lewat
  // update (dijaga Security Rules), jadi dokumennya diganti utuh.
  for (const i of sekarang) await deleteDoc(doc(db, "payrollBulananItems", i.id));

  const batch = writeBatch(db);
  items.forEach((i) =>
    batch.set(doc(db, "payrollBulananItems", idItem(p.bulan, i.employeeId)), {
      ...i,
      payrollId: p.bulan,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  batch.update(doc(db, "payrollBulanan", p.bulan), { ...jumlahkanBulanan(items), updatedAt: serverTimestamp() });
  await batch.commit();
  return items.length;
}

async function segarkanTotal(bulan: string) {
  const db = dbClient();
  const snap = await getDocs(query(collection(db, "payrollBulananItems"), where("payrollId", "==", bulan)));
  const items = snap.docs.map((d) => d.data() as ItemBaru);
  await updateDoc(doc(db, "payrollBulanan", bulan), { ...jumlahkanBulanan(items), updatedAt: serverTimestamp() });
}

export async function ubahItemBulanan(item: ItemPayrollBulanan, ubahan: Partial<IsianManual>) {
  const baru = hitungAngka({ ...item, ...ubahan });
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  KOLOM_MANUAL.forEach((k) => (data[k] = baru[k]));
  data.kotor = baru.kotor;
  data.totalPotongan = baru.totalPotongan;
  data.bersih = baru.bersih;
  await updateDoc(doc(dbClient(), "payrollBulananItems", item.id), data);
  await segarkanTotal(item.payrollId);
  return baru;
}

const URUTAN: StatusPayroll[] = ["DRAFT", "REVIEW", "APPROVED", "PAID", "LOCKED"];

export function statusBerikutBulanan(s: StatusPayroll): StatusPayroll | null {
  const i = URUTAN.indexOf(s);
  return i >= 0 && i < URUTAN.length - 1 ? URUTAN[i + 1] : null;
}

/**
 * Memajukan status. Saat mencapai APPROVED, potongan bon dibukukan sebagai
 * pembayaran - sekali saja, dijaga penanda bonDiproses.
 */
export async function majukanStatusBulanan(p: PayrollBulanan, oleh: string) {
  const baru = statusBerikutBulanan(p.status);
  if (!baru) throw new Error("Payroll sudah terkunci.");
  const db = dbClient();

  if (baru === "APPROVED" && !p.bonDiproses) {
    const snap = await getDocs(query(collection(db, "payrollBulananItems"), where("payrollId", "==", p.bulan)));
    const daftarBon = await bonBerjalan();
    for (const d of snap.docs) {
      const item = d.data() as ItemPayrollBulanan;
      if (!item.potonganBon || item.potonganBon <= 0) continue;
      const bon = daftarBon.find((b) => b.employeeId === item.employeeId);
      if (!bon) continue;
      const jumlah = Math.min(item.potonganBon, bon.remainingAmount);
      if (jumlah <= 0) continue;
      await catatPembayaranBon({
        bon,
        jumlah,
        catatan: `Potongan payroll bulanan ${p.bulan}`,
        payrollId: `BULANAN-${p.bulan}`,
        oleh,
      });
    }
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "payrollBulanan", p.bulan), {
    status: baru,
    bonDiproses: p.bonDiproses || baru === "APPROVED",
    disetujuiOleh: baru === "APPROVED" ? oleh : p.disetujuiOleh ?? null,
    updatedAt: serverTimestamp(),
  });

  // Begitu ditandai Dibayar, slip gaji terbit ke masing-masing karyawan -
  // dalam batch yang sama, jadi tidak ada keadaan "sudah dibayar tapi slip
  // belum ada".
  if (baru === "PAID") {
    for (const s of await susunSlip(p.bulan, oleh)) {
      batch.set(doc(db, "slipGaji", s.id), { ...s, createdAt: serverTimestamp() });
    }
  }

  await batch.commit();
  return baru;
}

/* ============================ Slip gaji ============================ */

/**
 * Seluruh baris payroll sebulan, dijadikan bentuk slip lengkap dengan
 * lampiran absensi harian, sisa cuti/sakit, riwayat kasbon, dan SP -
 * mengikuti form slip manual perusahaan.
 */
export async function susunSlip(bulan: string, oleh: string) {
  const db = dbClient();
  const tahun = Number(bulan.slice(0, 4));
  const [itemSnap, bahan, saldoSnap, bonSnap, bayarSnap, spSnap] = await Promise.all([
    getDocs(query(collection(db, "payrollBulananItems"), where("payrollId", "==", bulan))),
    ambilBahanRekap(bulan),
    getDocs(query(collection(db, "leaveBalances"), where("tahun", "==", tahun))).catch(() => null),
    getDocs(collection(db, "employeeLoans")).catch(() => null),
    getDocs(collection(db, "loanRepayments")).catch(() => null),
    getDocs(collection(db, "warningLetters")).catch(() => null),
  ]);

  const karyawan = new Map(bahan.karyawan.map((k) => [k.id, k]));
  const rekap = hitungRekap({ bulan, hariIni: tanggalHariIni(), ...bahan });
  const rekapPer = new Map(rekap.baris.map((b) => [b.employeeId, b]));
  const akhirBulan = rekap.tanggal[rekap.tanggal.length - 1];
  const awalBulan = rekap.tanggal[0];

  const saldo = new Map(
    (saldoSnap?.docs || []).map((d) => {
      const x = d.data() as SaldoCuti;
      return [x.employeeId, x];
    })
  );
  const bon = (bonSnap?.docs || []).map((d) => ({ id: d.id, ...(d.data() as Omit<EmployeeLoan, "id">) }));
  const bayar = (bayarSnap?.docs || []).map((d) => ({ id: d.id, ...(d.data() as Omit<LoanRepayment, "id">) }));
  const sp = (spSnap?.docs || []).map((d) => ({ id: d.id, ...(d.data() as Omit<SuratPeringatan, "id">) }));

  const tanggalDari = (x: unknown): string => {
    const t = (x as { toDate?: () => Date })?.toDate?.();
    return t ? keTanggal(t) : "";
  };

  return itemSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<ItemPayrollBulanan, "id">) }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "id"))
    .map((i) => {
      const baris = rekapPer.get(i.employeeId);
      const lampiran = baris ? susunLampiranSlip({ hasil: rekap, baris, absen: bahan.absen, cuti: bahan.cuti }) : undefined;

      const sc = saldo.get(i.employeeId);
      const sisaCuti = sc ? sc.jatahTahunan + sc.penyesuaian - sc.tahunanTerpakai : null;
      const sisaSakit = sc ? sc.jatahSakit - sc.sakitTerpakai : null;

      // Kasbon: pinjaman sebagai debet, cicilan sebagai kredit - sampai akhir bulan ini.
      const bonnya = bon.filter((b) => b.employeeId === i.employeeId && b.status !== "CANCELLED" && b.loanDate <= akhirBulan);
      const idBon = new Set(bonnya.map((b) => b.id));
      const kasbon: NonNullable<SlipGaji["kasbon"]> = [
        ...bonnya.map((b) => ({ tanggal: b.loanDate, uraian: b.description || "Kasbon", debet: b.originalAmount, kredit: 0 })),
        ...bayar
          .filter((r) => idBon.has(r.loanId))
          .map((r) => ({ tanggal: tanggalDari(r.createdAt) || akhirBulan, uraian: r.catatan, debet: 0, kredit: r.amount }))
          .filter((r) => r.tanggal <= akhirBulan),
      ];
      // Selama belum disetujui, potongan bulan ini belum dibukukan; tampilkan sebagai rencana.
      const sudahDibukukan = bayar.some((r) => r.payrollId === `BULANAN-${bulan}` && r.employeeId === i.employeeId);
      if (i.potonganBon > 0 && !sudahDibukukan) {
        kasbon.push({ tanggal: akhirBulan, uraian: `Potongan gaji ${bulan}`, debet: 0, kredit: i.potonganBon });
      }
      kasbon.sort((a, b) => a.tanggal.localeCompare(b.tanggal));

      const spBerlaku = sp
        .filter((x) => x.employeeId === i.employeeId && !x.dicabut && x.tanggalTerbit <= akhirBulan && x.berlakuSampai >= awalBulan)
        .map((x) => ({ tingkat: x.tingkat, tanggal: x.tanggalTerbit }));

      return keSlip(i, karyawan.get(i.employeeId), oleh, { lampiran, sisaCuti, sisaSakit, kasbon, sp: spBerlaku });
    });
}

export function pantauSlipBulan(bulan: string, setData: (d: SlipGaji[]) => void, gagal: () => void) {
  return onSnapshot(
    query(collection(dbClient(), "slipGaji"), where("bulan", "==", bulan)),
    (snap) => setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SlipGaji, "id">) }))),
    gagal
  );
}

/** Slip milik karyawan yang sedang login. */
export function pantauSlipSaya(employeeId: string, setData: (d: SlipGaji[]) => void, gagal: () => void) {
  return onSnapshot(
    query(collection(dbClient(), "slipGaji"), where("employeeId", "==", employeeId)),
    (snap) =>
      setData(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<SlipGaji, "id">) }))
          .sort((a, b) => b.bulan.localeCompare(a.bulan))
      ),
    gagal
  );
}

/**
 * Menerbitkan slip yang belum ada, untuk payroll yang sudah Dibayar atau
 * Dikunci. Slip yang sudah terbit tidak disentuh - slip adalah dokumen
 * yang sudah diterima karyawan.
 */
export async function terbitkanSlipYangKurang(p: PayrollBulanan, sudah: SlipGaji[], oleh: string) {
  if (p.status !== "PAID" && p.status !== "LOCKED") {
    throw new Error("Slip baru bisa diterbitkan setelah payroll ditandai Dibayar.");
  }
  const ada = new Set(sudah.map((s) => s.id));
  const kurang = (await susunSlip(p.bulan, oleh)).filter((s) => !ada.has(s.id));
  if (!kurang.length) return 0;
  const db = dbClient();
  const batch = writeBatch(db);
  kurang.forEach((s) => batch.set(doc(db, "slipGaji", s.id), { ...s, createdAt: serverTimestamp() }));
  await batch.commit();
  return kurang.length;
}

export async function kembalikanBulananKeDraft(p: PayrollBulanan) {
  if (p.status !== "REVIEW") throw new Error("Hanya payroll berstatus REVIEW yang bisa dikembalikan ke DRAFT.");
  await updateDoc(doc(dbClient(), "payrollBulanan", p.bulan), {
    status: "DRAFT" as StatusPayroll,
    updatedAt: serverTimestamp(),
  });
}

export async function hapusPayrollBulanan(p: PayrollBulanan, items: ItemPayrollBulanan[]) {
  if (p.status !== "DRAFT") throw new Error("Hanya payroll berstatus DRAFT yang bisa dihapus.");
  const db = dbClient();
  for (const i of items) await deleteDoc(doc(db, "payrollBulananItems", i.id));
  await deleteDoc(doc(db, "payrollBulanan", p.bulan));
}
