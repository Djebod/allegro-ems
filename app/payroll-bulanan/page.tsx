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
  isiJenisTunjanganBawaan,
  pantauDaftarPayrollBulanan,
  pantauGajiBulanan,
  pantauJenisTunjangan,
  pasangGajiBaru,
  simpanJenisTunjangan,
} from "@/lib/data-payroll-bulanan";
import { NAMA_STATUS, SAMARAN_GAJI, bolehLihatGaji, warnaStatus } from "@/lib/payroll-bulanan";
import TombolLihatGaji from "@/components/TombolLihatGaji";
import type { Employee, GajiBulanan, JenisTunjangan, PayrollBulanan, SatuanTunjangan } from "@/types";

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
  const boleh = bolehLihatGaji(profile?.role);
  // Selalu mulai tersamar setiap halaman dibuka.
  const [tampil, setTampil] = useState(false);
  const gajiTeks = (n: number) => (boleh && tampil ? rupiahPenuh(n) : SAMARAN_GAJI);
  const bulanIni = tanggalHariIni().slice(0, 7);
  const [karyawan, setKaryawan] = useState<Employee[]>([]);
  const [gaji, setGaji] = useState<GajiBulanan[]>([]);
  const [jenis, setJenis] = useState<JenisTunjangan[]>([]);
  const [isiTunjangan, setIsiTunjangan] = useState<Record<string, string>>({});
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
    const a = pantauGajiBulanan(setGaji, () =>
      setSalah("Data gaji pokok tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.")
    );
    const b = pantauJenisTunjangan(setJenis, () => setJenis([]));
    return () => {
      a();
      b();
    };
  }, []);

  const jenisAktif = jenis.filter((j) => j.aktif);
  /** Tunjangan tetap sebulan: per bulan apa adanya, per hari dihitung 25 hari sebagai perkiraan. */
  const totalTunjanganBulanan = (g: GajiBulanan | null) =>
    jenisAktif.reduce((t, j) => t + (g?.tunjangan?.[j.id] || 0) * (j.satuan === "HARI" ? 25 : 1), 0);

  // Sama dengan peserta rekap bulanan: staf kantor yang aktif.
  const staf = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    // Staf kantor ditambah direksi yang tidak wajib absen (tetap digaji).
    const direksi = karyawan.filter((e) => e.tidakWajibAbsen);
    return [...pesertaRekap(karyawan, []), ...direksi]
      .filter((e) => e.status === "ACTIVE")
      .sort((a, b) => a.name.localeCompare(b.name, "id"))
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
    setIsiTunjangan(
      Object.fromEntries(jenis.map((j) => [j.id, kini?.tunjangan?.[j.id] ? keRupiah(kini.tunjangan[j.id]) : ""]))
    );
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
        tunjangan: Object.fromEntries(Object.entries(isiTunjangan).map(([k, v]) => [k, bacaAngka(v)])),
        berlakuMulai: mulai,
        catatan,
        semua: gaji,
        oleh: profile?.name || "",
      });
      setPesan(`Gaji dan tunjangan ${buka.name} tersimpan, berlaku mulai ${namaBulan(mulai)}.`);
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
        {!boleh && (
          <p className="mt-2 text-xs font-semibold text-muted">
            Angka gaji tersamar. Hanya Owner, Finance, dan HR yang bisa melihat dan mengisinya.
          </p>
        )}
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
              <th className="text-right">
                Gaji pokok
                <TombolLihatGaji tampil={tampil} boleh={boleh} ubah={setTampil} />
              </th>
              <th className="text-right">Tunjangan/bln (perkiraan)</th>
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
                      <span className="font-semibold tracking-wider text-ink">{gajiTeks(g.gajiPokok)}</span>
                    ) : (
                      <span className="text-bahaya">belum diisi</span>
                    )}
                  </td>
                  <td className="text-right tracking-wider">
                    {g && totalTunjanganBulanan(g) ? (boleh && tampil ? rupiahPenuh(totalTunjanganBulanan(g)) : SAMARAN_GAJI) : "-"}
                  </td>
                  <td>{g ? namaBulan(g.berlakuMulai) : "-"}</td>
                  <td className="text-right">
                    {/* Mengisi gaji berarti melihat angkanya, jadi ikut dibatasi. */}
                    {boleh ? (
                      <button className="btn-kuning" onClick={() => bukaForm(e)}>
                        {g ? "Ubah" : "Isi"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal judul={buka ? `Gaji & tunjangan · ${buka.name}` : ""} terbuka={!!buka} onTutup={() => setBuka(null)}>
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
            <div className="rounded-lg border border-line p-3">
              <p className="mb-2 text-sm font-semibold text-ink">Tunjangan tetap</p>
              {jenisAktif.length === 0 ? (
                <p className="text-xs text-muted">
                  Belum ada jenis tunjangan. Atur dulu di tab <b>Tunjangan</b>.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {jenisAktif.map((j) => (
                    <Field key={j.id} label={`${j.nama} (${j.satuan === "HARI" ? "per hari masuk" : "per bulan"})`}>
                      <input
                        className="input-dasar"
                        inputMode="numeric"
                        placeholder="0 = tidak dapat"
                        value={isiTunjangan[j.id] || ""}
                        onChange={(e) =>
                          setIsiTunjangan((x) => ({
                            ...x,
                            [j.id]: bacaAngka(e.target.value) ? keRupiah(bacaAngka(e.target.value)) : "",
                          }))
                        }
                      />
                    </Field>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted">
                Tunjangan per hari dikali jumlah hari masuk kerja (hadir + dinas luar) di bulan itu. Bonus bulanan
                diisi terpisah di payroll setiap bulan.
              </p>
            </div>
            <Field
              label="Berlaku mulai bulan"
              wajib
              bantuan={
                berlaku(buka.id)
                  ? "Gaji yang sekarang otomatis ditutup. Pilih bulan yang sama untuk membetulkan isian."
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
                    {gajiTeks(g.gajiPokok)} · {namaBulan(g.berlakuMulai)} –{" "}
                    {g.berlakuSampai && g.berlakuSampai < g.berlakuMulai
                      ? "dibetulkan"
                      : g.berlakuSampai
                      ? namaBulan(g.berlakuSampai)
                      : "sekarang"}
                    {g.catatan ? ` · ${g.catatan}` : ""}
                  </p>
                ))}
              </div>
            )}

            {salahForm && <Pesan jenis="gagal" isi={salahForm} />}
            <button className="btn-utama w-full" onClick={simpan} disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Simpan gaji & tunjangan"}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ========================= Jenis tunjangan ========================= */

function Tunjangan() {
  const [jenis, setJenis] = useState<JenisTunjangan[] | null>(null);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [ubah, setUbah] = useState<Partial<JenisTunjangan> | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(
    () =>
      pantauJenisTunjangan(setJenis, () => {
        setSalah("Daftar tunjangan tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
        setJenis([]);
      }),
    []
  );

  async function simpan() {
    if (!ubah) return;
    setSibuk(true);
    setSalah(null);
    try {
      await simpanJenisTunjangan({
        id: ubah.id,
        nama: ubah.nama || "",
        satuan: (ubah.satuan as SatuanTunjangan) || "BULAN",
        urutan: Number(ubah.urutan) || (jenis?.length || 0) + 1,
        aktif: ubah.aktif ?? true,
      });
      setPesan(`Tunjangan "${ubah.nama}" tersimpan.`);
      setUbah(null);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
    }
  }

  if (jenis === null) return <p className="text-muted">Memuat…</p>;

  return (
    <>
      <div className="kartu !p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-muted">
            Daftar jenis tunjangan untuk slip gaji. Nominal per orang diisi di tab <b>Gaji pokok</b>. Jenis yang tidak
            dipakai lagi cukup <b>dinonaktifkan</b>, supaya payroll bulan-bulan lalu tetap utuh.
          </p>
          <div className="flex gap-2">
            {jenis.length === 0 && (
              <button
                className="btn-ringan"
                disabled={sibuk}
                onClick={async () => {
                  setSibuk(true);
                  try {
                    await isiJenisTunjanganBawaan();
                    setPesan("Daftar bawaan dari slip lama sudah ditambahkan.");
                  } catch {
                    setSalah("Gagal menambahkan daftar bawaan.");
                  } finally {
                    setSibuk(false);
                  }
                }}
              >
                Isi daftar dari slip lama
              </button>
            )}
            <button className="btn-utama" onClick={() => setUbah({ satuan: "BULAN", aktif: true, urutan: jenis.length + 1 })}>
              + Tambah tunjangan
            </button>
          </div>
        </div>
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

      {jenis.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="tabel-padat min-w-[560px]">
            <thead>
              <tr>
                <th className="w-12">Urut</th>
                <th>Nama tunjangan</th>
                <th>Dihitung</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jenis.map((j) => (
                <tr key={j.id} className={j.aktif ? "" : "opacity-60"}>
                  <td>{j.urutan}</td>
                  <td className="font-semibold text-ink">{j.nama}</td>
                  <td>{j.satuan === "HARI" ? "Per hari masuk kerja" : "Per bulan"}</td>
                  <td>
                    <span className={`label-status ${j.aktif ? "bg-green-100 text-green-800" : "bg-surface text-muted"}`}>
                      {j.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="text-right">
                    <button className="btn-kuning" onClick={() => setUbah(j)}>
                      Ubah
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Bonus bulanan tidak perlu didaftarkan di sini: nilainya berbeda tiap bulan, jadi diisi langsung di payroll.
      </p>

      <Modal judul={ubah?.id ? "Ubah tunjangan" : "Tambah tunjangan"} terbuka={!!ubah} onTutup={() => setUbah(null)}>
        {ubah && (
          <div className="space-y-4">
            <Field label="Nama tunjangan" wajib>
              <input
                className="input-dasar"
                value={ubah.nama || ""}
                onChange={(e) => setUbah({ ...ubah, nama: e.target.value })}
                placeholder="mis. Tunjangan Jabatan"
              />
            </Field>
            <Field
              label="Cara menghitung"
              wajib
              bantuan="Per hari: nominal dikali jumlah hari masuk kerja bulan itu (hadir + dinas luar)."
            >
              <select
                className="input-dasar"
                value={ubah.satuan || "BULAN"}
                onChange={(e) => setUbah({ ...ubah, satuan: e.target.value as SatuanTunjangan })}
              >
                <option value="BULAN">Per bulan (nominal tetap)</option>
                <option value="HARI">Per hari masuk kerja</option>
              </select>
            </Field>
            <Field label="Urutan di slip">
              <input
                className="input-dasar"
                type="number"
                min={1}
                value={ubah.urutan ?? ""}
                onChange={(e) => setUbah({ ...ubah, urutan: Number(e.target.value) })}
              />
            </Field>
            {ubah.id && (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={ubah.aktif ?? true} onChange={(e) => setUbah({ ...ubah, aktif: e.target.checked })} />
                Aktif (tampil di slip dan dihitung di payroll)
              </label>
            )}
            <button className="btn-utama w-full" onClick={simpan} disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ============================ Halaman ============================ */

function Isi() {
  const [tab, setTab] = useState<"daftar" | "gaji" | "tunjangan">("daftar");
  return (
    <>
      <div className="mb-4 inline-flex rounded-lg border border-line bg-white p-0.5">
        {(
          [
            ["daftar", "Payroll per bulan"],
            ["gaji", "Gaji pokok"],
            ["tunjangan", "Tunjangan"],
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
      {tab === "daftar" ? <Daftar /> : tab === "gaji" ? <GajiPokok /> : <Tunjangan />}
    </>
  );
}

export default function HalamanPayrollBulanan() {
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER", "FINANCE"]}>
      <Shell judul="Payroll Bulanan" keterangan="Gaji staf kantor per bulan." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
