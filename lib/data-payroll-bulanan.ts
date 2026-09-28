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
import { tanggalHariIni } from "@/lib/absensi";
import { bonBerjalan, catatPembayaranBon } from "@/lib/data";
import { ambilBahanRekap } from "@/lib/data-rekap";
import { hitungRekap } from "@/lib/rekap-kantor";
import {
  KOLOM_MANUAL,
  gajiUntukBulan,
  hitungAngka,
  jumlahkanBulanan,
  susunItemBulanan,
  type IsianManual,
  type ItemBaru,
} from "@/lib/payroll-bulanan";
import type { GajiBulanan, ItemPayrollBulanan, PayrollBulanan, StatusPayroll } from "@/types";

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
  berlakuMulai: string;
  catatan: string;
  semua: GajiBulanan[];
  oleh: string;
}) {
  const gaji = Math.round(opsi.gajiPokok);
  if (!(gaji > 0)) throw new Error("Gaji pokok harus lebih dari nol.");
  if (!/^\d{4}-\d{2}$/.test(opsi.berlakuMulai)) throw new Error("Bulan mulai berlaku belum dipilih.");

  const berjalan = opsi.semua.find((g) => g.employeeId === opsi.employeeId && g.berlakuSampai === null);
  if (berjalan && opsi.berlakuMulai <= berjalan.berlakuMulai) {
    throw new Error(
      `Gaji yang sekarang berlaku mulai ${berjalan.berlakuMulai}. Gaji baru harus berlaku setelah bulan itu.`
    );
  }

  const db = dbClient();
  const batch = writeBatch(db);
  if (berjalan) {
    batch.update(doc(db, "gajiBulanan", berjalan.id), { berlakuSampai: bulanSebelum(opsi.berlakuMulai) });
  }
  batch.set(doc(collection(db, "gajiBulanan")), {
    employeeId: opsi.employeeId,
    gajiPokok: gaji,
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
async function susunSemua(bulan: string, lama: Map<string, Partial<IsianManual>> = new Map()) {
  const [bahan, gajiSnap, bon] = await Promise.all([
    ambilBahanRekap(bulan),
    getDocs(collection(dbClient(), "gajiBulanan")),
    bonBerjalan(),
  ]);
  const gaji = gajiSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GajiBulanan, "id">) }));
  const rekap = hitungRekap({ bulan, hariIni: tanggalHariIni(), ...bahan });

  const items = rekap.baris.map((r) =>
    susunItemBulanan({
      bulan,
      rekap: r,
      gaji: gajiUntukBulan(gaji, r.employeeId, bulan),
      bon: bon.find((b) => b.employeeId === r.employeeId),
      lama: lama.get(r.employeeId),
    })
  );
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

  const lama = new Map<string, Partial<IsianManual>>();
  sekarang.forEach((i) => {
    const isian: Partial<IsianManual> = {};
    KOLOM_MANUAL.forEach((k) => ((isian as Record<string, unknown>)[k] = i[k]));
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

  await updateDoc(doc(db, "payrollBulanan", p.bulan), {
    status: baru,
    bonDiproses: p.bonDiproses || baru === "APPROVED",
    disetujuiOleh: baru === "APPROVED" ? oleh : p.disetujuiOleh ?? null,
    updatedAt: serverTimestamp(),
  });
  return baru;
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
