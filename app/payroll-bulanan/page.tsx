"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { dbClient } from "@/lib/firebase";
import { tanggalHariIni } from "@/lib/absensi";
import { bacaAngka, keRupiah, rupiahPenuh } from "@/lib/rupiah";
import { namaBulan, pesertaRekap } from "@/lib/rekap-kantor";
import {
  buatPayrollBulanan,
  pantauDaftarPayrollBulanan,
  pantauGajiBulanan,
  pasangGajiBaru,
} from "@/lib/data-payroll-bulanan";
import { NAMA_STATUS, warnaStatus } from "@/lib/payroll-bulanan";
import type { Employee, GajiBulanan, PayrollBulanan } from "@/types";

/* ============================ Daftar ============================ */

function Daftar() {
  const { profile } = useAuth();
  const router = useRouter();
  const bulanIni = tanggalHariIni().slice(0, 7);
  const [bulan, setBulan] = useState(bulanIni);
  const [daftar, setDaftar] = useState<PayrollBulanan[]>([]);
  const [salah, setSalah] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(
    () =>
      pantauDaftarPayrollBulanan(setDaftar, () =>
        setSalah("Data payroll tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.")
      ),
    []
  );

  const sudahAda = daftar.some((p) => p.bulan === bulan);

  async function hitung() {
    if (bulan >= bulanIni) {
      const lanjut = window.confirm(
        `${namaBulan(bulan)} belum selesai. Angka kehadirannya baru sampai kemarin dan harus dihitung ulang di akhir bulan. Tetap buat sekarang?`
      );
      if (!lanjut) return;
    }
    setSibuk(true);
    setSalah(null);
    try {
      await buatPayrollBulanan(bulan, profile?.name || "");
      router.push(`/payroll-bulanan/${bulan}`);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Payroll gagal dibuat.");
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="kartu !p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Bulan">
            <input
              type="month"
              className="input-dasar"
              value={bulan}
              max={bulanIni}
              onChange={(e) => e.target.value && setBulan(e.target.value)}
            />
          </Field>
          {sudahAda ? (
            <Link href={`/payroll-bulanan/${bulan}`} className="btn-utama">
              Buka payroll {namaBulan(bulan)}
            </Link>
          ) : (
            <button className="btn-utama" onClick={hitung} disabled={sibuk}>
              {sibuk ? "Menghitung…" : `Hitung payroll ${namaBulan(bulan)}`}
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Angka kehadiran, alpa, dan denda telat diambil dari Rekap Bulanan. Gaji pokok dari tab Gaji Pokok. Lembur,
          potongan alpa, dan uang kerajinan diisi manual sesudahnya.
        </p>
      </div>

      {salah && (
        <div className="mt-4">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}

      {daftar.length === 0 ? (
        <div className="kartu mt-4 text-center">
          <p className="text-sm text-muted">Belum ada payroll bulanan.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="tabel-padat min-w-[760px]">
            <thead>
              <tr>
                <th>Bulan</th>
                <th>Status</th>
                <th className="text-right">Karyawan</th>
                <th className="text-right">Kotor</th>
                <th className="text-right">Potongan</th>
                <th className="text-right">Diterima</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold text-ink">{namaBulan(p.bulan)}</td>
                  <td>
                    <span className={`label-status ${warnaStatus(p.status)}`}>{NAMA_STATUS[p.status]}</span>
                  </td>
                  <td className="text-right">{p.totalKaryawan}</td>
                  <td className="text-right">{keRupiah(p.totalKotor)}</td>
                  <td className="text-right">{keRupiah(p.totalPotongan)}</td>
                  <td className="text-right font-semibold text-ink">{keRupiah(p.totalBersih)}</td>
                  <td className="text-right">
                    <Link href={`/payroll-bulanan/${p.bulan}`} className="btn-kuning">
                      Buka
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ========================== Gaji pokok ========================== */

function GajiPokok() {
  const { profile } = useAuth();
  const bulanIni = tanggalHariIni().slice(0, 7);
  const [karyawan, setKaryawan] = useState<Employee[]>([]);
  const [gaji, setGaji] = useState<GajiBulanan[]>([]);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [cari, setCari] = useState("");

  const [buka, setBuka] = useState<Employee | null>(null);
  const [nilai, setNilai] = useState("");
  const [mulai, setMulai] = useState(bulanIni);
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [salahForm, setSalahForm] = useState<string | null>(null);

  useEffect(() => {
    getDocs(collection(dbClient(), "employees"))
      .then((s) => setKaryawan(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) }))))
      .catch(() => setSalah("Data karyawan tidak bisa dibaca."));
    return pantauGajiBulanan(setGaji, () =>
      setSalah("Data gaji pokok tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.")
    );
  }, []);

  // Sama dengan peserta rekap bulanan: staf kantor yang aktif.
  const staf = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return pesertaRekap(karyawan, [])
      .filter((e) => e.status === "ACTIVE")
      .filter((e) => !kata || `${e.name} ${e.id} ${e.divisi || ""}`.toLowerCase().includes(kata));
  }, [karyawan, cari]);

  const berlaku = (id: string) => gaji.find((g) => g.employeeId === id && g.berlakuSampai === null) || null;
  const riwayat = (id: string) =>
    gaji.filter((g) => g.employeeId === id).sort((a, b) => b.berlakuMulai.localeCompare(a.berlakuMulai));

  const belumAda = staf.filter((e) => !berlaku(e.id)).length;

  function bukaForm(e: Employee) {
    const kini = berlaku(e.id);
    setBuka(e);
    setNilai(kini ? keRupiah(kini.gajiPokok) : "");
    setMulai(kini && kini.berlakuMulai >= bulanIni ? kini.berlakuMulai : bulanIni);
    setCatatan("");
    setSalahForm(null);
  }

  async function simpan() {
    if (!buka) return;
    setSibuk(true);
    setSalahForm(null);
    try {
      await pasangGajiBaru({
        employeeId: buka.id,
        gajiPokok: bacaAngka(nilai),
        berlakuMulai: mulai,
        catatan,
        semua: gaji,
        oleh: profile?.name || "",
      });
      setPesan(`Gaji pokok ${buka.name} tersimpan, berlaku mulai ${namaBulan(mulai)}.`);
      setBuka(null);
    } catch (e) {
      setSalahForm(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="kartu !p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input-dasar max-w-sm"
            placeholder="Cari nama, kode, atau divisi"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
          />
          <p className={`text-sm ${belumAda ? "font-semibold text-bahaya" : "text-muted"}`}>
            {belumAda ? `${belumAda} staf belum punya gaji pokok` : "Semua staf sudah punya gaji pokok"}
          </p>
        </div>
        <p className="mt-2 text-xs text-muted">
          Gaji tidak pernah ditimpa. Mengubah gaji berarti menutup gaji lama di bulan sebelumnya dan membuat gaji baru,
          sehingga payroll bulan-bulan lalu tetap memakai angka yang berlaku saat itu.
        </p>
      </div>

      {salah && (
        <div className="mt-4">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}
      {pesan && !salah && (
        <div className="mt-4">
          <Pesan jenis="berhasil" isi={pesan} />
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="tabel-padat min-w-[640px]">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Divisi</th>
              <th className="text-right">Gaji pokok</th>
              <th>Berlaku mulai</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staf.map((e) => {
              const g = berlaku(e.id);
              return (
                <tr key={e.id}>
                  <td>
                    <p className="font-semibold text-ink">{e.name}</p>
                    <p className="text-[10px] text-muted">{e.id}</p>
                  </td>
                  <td>{e.divisi || "-"}</td>
                  <td className="text-right">
                    {g ? (
                      <span className="font-semibold text-ink">{rupiahPenuh(g.gajiPokok)}</span>
                    ) : (
                      <span className="text-bahaya">belum diisi</span>
                    )}
                  </td>
                  <td>{g ? namaBulan(g.berlakuMulai) : "-"}</td>
                  <td className="text-right">
                    <button className="btn-kuning" onClick={() => bukaForm(e)}>
                      {g ? "Ubah" : "Isi"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal judul={buka ? `Gaji pokok · ${buka.name}` : ""} terbuka={!!buka} onTutup={() => setBuka(null)}>
        {buka && (
          <div className="space-y-4">
            <Field label="Gaji pokok per bulan (Rp)" wajib>
              <input
                className="input-dasar"
                inputMode="numeric"
                value={nilai}
                onChange={(e) => setNilai(bacaAngka(e.target.value) ? keRupiah(bacaAngka(e.target.value)) : "")}
                placeholder="mis. 4.500.000"
              />
            </Field>
            <Field
              label="Berlaku mulai bulan"
              wajib
              bantuan={
                berlaku(buka.id)
                  ? "Gaji yang sekarang otomatis ditutup di bulan sebelumnya."
                  : "Isi bulan pertama gaji ini dipakai di payroll."
              }
            >
              <input type="month" className="input-dasar" value={mulai} onChange={(e) => setMulai(e.target.value)} />
            </Field>
            <Field label="Catatan" bantuan="mis. kenaikan tahunan, penyesuaian jabatan">
              <input className="input-dasar" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
            </Field>

            {riwayat(buka.id).length > 0 && (
              <div className="rounded-lg border border-line p-3">
                <p className="mb-2 text-xs font-semibold text-ink">Riwayat</p>
                {riwayat(buka.id).map((g) => (
                  <p key={g.id} className="text-xs text-muted">
                    {rupiahPenuh(g.gajiPokok)} · {namaBulan(g.berlakuMulai)} –{" "}
                    {g.berlakuSampai ? namaBulan(g.berlakuSampai) : "sekarang"}
                    {g.catatan ? ` · ${g.catatan}` : ""}
                  </p>
                ))}
              </div>
            )}

            {salahForm && <Pesan jenis="gagal" isi={salahForm} />}
            <button className="btn-utama w-full" onClick={simpan} disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Simpan gaji pokok"}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ============================ Halaman ============================ */

function Isi() {
  const [tab, setTab] = useState<"daftar" | "gaji">("daftar");
  return (
    <>
      <div className="mb-4 inline-flex rounded-lg border border-line bg-white p-0.5">
        {(
          [
            ["daftar", "Payroll per bulan"],
            ["gaji", "Gaji pokok"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-md px-4 py-1.5 text-sm ${
              tab === k ? "bg-allegro-700 font-semibold text-white" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "daftar" ? <Daftar /> : <GajiPokok />}
    </>
  );
}

export default function HalamanPayrollBulanan() {
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER"]}>
      <Shell judul="Payroll Bulanan" keterangan="Gaji staf kantor per bulan." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
