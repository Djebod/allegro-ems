"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { semuaKaryawan } from "@/lib/data";
import {
  ambilHariLibur,
  pantauPengajuan,
  pantauSaldo,
  putuskanPengajuan,
  siapkanSaldo,
  ubahSaldo,
} from "@/lib/data-cuti";
import { JENIS_CUTI, sisaSakit, sisaTahunan } from "@/lib/cuti";
import { tanggalPendek } from "@/lib/absensi";
import type { Employee, PengajuanCuti, SaldoCuti, StatusPengajuan } from "@/types";

function warnaStatus(s: StatusPengajuan) {
  if (s === "DISETUJUI") return "bg-green-100 text-green-800";
  if (s === "DITOLAK") return "bg-red-100 text-bahaya";
  if (s === "DIBATALKAN") return "bg-surface text-muted";
  return "bg-kuning-400/40 text-allegro-700";
}

function Isi() {
  const { profile } = useAuth();
  const tahun = new Date().getFullYear();

  const [tab, setTab] = useState<"PENGAJUAN" | "SALDO">("PENGAJUAN");
  const [pengajuan, setPengajuan] = useState<PengajuanCuti[]>([]);
  const [saldo, setSaldo] = useState<SaldoCuti[]>([]);
  const [karyawan, setKaryawan] = useState<Employee[]>([]);
  const [saring, setSaring] = useState<"DIAJUKAN" | "SEMUA" | StatusPengajuan>("DIAJUKAN");
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const [putus, setPutus] = useState<PengajuanCuti | null>(null);
  const [catatan, setCatatan] = useState("");

  const [ubahSaldoUntuk, setUbahSaldoUntuk] = useState<SaldoCuti | null>(null);
  const [uJatah, setUJatah] = useState("");
  const [uPenyesuaian, setUPenyesuaian] = useState("");
  const [uCatatan, setUCatatan] = useState("");

  useEffect(() => {
    semuaKaryawan().then(setKaryawan).catch(() => {});
    const lepasP = pantauPengajuan(setPengajuan, () =>
      setSalah("Data pengajuan tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.")
    );
    const lepasS = pantauSaldo(tahun, setSaldo, () => {});
    return () => {
      lepasP();
      lepasS();
    };
  }, [tahun]);

  const terlihat = useMemo(
    () => (saring === "SEMUA" ? pengajuan : pengajuan.filter((p) => p.status === saring)),
    [pengajuan, saring]
  );

  const belumPunyaSaldo = useMemo(
    () =>
      karyawan.filter(
        (k) => k.status === "ACTIVE" && !saldo.some((s) => s.employeeId === k.id)
      ),
    [karyawan, saldo]
  );

  async function simpanKeputusan(status: "DISETUJUI" | "DITOLAK") {
    if (!putus) return;
    setSibuk(true);
    setSalah(null);
    try {
      await putuskanPengajuan({
        pengajuan: putus,
        status,
        catatan: catatan.trim(),
        oleh: profile?.email || "",
      });
      setPutus(null);
      setCatatan("");
      setPesan(
        status === "DISETUJUI"
          ? "Pengajuan disetujui. Saldo cuti sudah dipotong bila jenisnya memotong."
          : "Pengajuan ditolak."
      );
    } catch {
      setSalah("Keputusan gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          className={tab === "PENGAJUAN" ? "btn-utama" : "btn-ringan"}
          onClick={() => setTab("PENGAJUAN")}
        >
          Pengajuan
        </button>
        <button
          className={tab === "SALDO" ? "btn-utama" : "btn-ringan"}
          onClick={() => setTab("SALDO")}
        >
          Saldo cuti {tahun}
        </button>
        <Link href="/hari-libur" className="btn-ringan">
          Hari libur
        </Link>

        {tab === "PENGAJUAN" && (
          <select
            className="input-dasar w-full sm:ml-auto sm:w-auto sm:max-w-[12rem]"
            value={saring}
            onChange={(e) => setSaring(e.target.value as typeof saring)}
          >
            <option value="DIAJUKAN">Menunggu keputusan</option>
            <option value="DISETUJUI">Disetujui</option>
            <option value="DITOLAK">Ditolak</option>
            <option value="DIBATALKAN">Dibatalkan</option>
            <option value="SEMUA">Semua</option>
          </select>
        )}
      </div>

      {salah && (
        <div className="mb-4">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}
      {pesan && !salah && (
        <div className="mb-4">
          <Pesan jenis="berhasil" isi={pesan} />
        </div>
      )}

      {tab === "PENGAJUAN" ? (
        terlihat.length === 0 ? (
          <div className="kartu text-center">
            <p className="text-sm text-muted">Tidak ada pengajuan pada saringan ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="tabel-padat">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Divisi</th>
                  <th>Jenis</th>
                  <th>Tanggal</th>
                  <th className="text-right">Hari</th>
                  <th>Alasan</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {terlihat.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-[170px]">
                      <p className="truncate font-semibold text-ink" title={p.employeeName}>
                        {p.employeeName}
                      </p>
                      <p className="text-[10px] text-muted">{p.employeeId}</p>
                    </td>
                    <td className="text-muted">{p.divisi || "—"}</td>
                    <td>
                      {JENIS_CUTI[p.jenis]?.label || p.jenis}
                      {p.mendesak && (
                        <span
                          className="ml-1 inline-block h-2 w-2 rounded-full bg-kuning-500 align-middle"
                          title="Diajukan sebagai keadaan mendesak"
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {tanggalPendek(p.tanggalMulai)}
                      {p.tanggalSelesai !== p.tanggalMulai &&
                        ` – ${tanggalPendek(p.tanggalSelesai)}`}
                      {p.jamKeluar && ` · ${p.jamKeluar}–${p.jamKembali}`}
                    </td>
                    <td className="text-right">{p.jumlahHari || "—"}</td>
                    <td className="max-w-[240px]">
                      <p className="truncate text-muted" title={p.alasan}>
                        {p.alasan}
                      </p>
                      {p.lampiranUrl && (
                        <a
                          href={p.lampiranUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] underline decoration-line underline-offset-2"
                        >
                          lihat lampiran
                        </a>
                      )}
                    </td>
                    <td>
                      <span className={`label-status ${warnaStatus(p.status)}`}>{p.status}</span>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {p.status === "DIAJUKAN" && (
                        <button className="btn-kuning" onClick={() => setPutus(p)}>
                          Putuskan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          {belumPunyaSaldo.length > 0 && (
            <div className="kartu mb-4">
              <p className="text-sm text-ink">
                {belumPunyaSaldo.length} karyawan aktif belum punya kartu cuti tahun {tahun}.
              </p>
              <p className="mt-1 text-xs text-muted">
                Jatahnya dihitung dari tanggal masuk — nol bila belum genap setahun bekerja, sesuai
                aturan perusahaan. Sesudah dibuat, saldo awalnya masih bisa disesuaikan.
              </p>
              <button
                className="btn-utama mt-3"
                disabled={sibuk}
                onClick={async () => {
                  setSibuk(true);
                  try {
                    for (const k of belumPunyaSaldo) {
                      await siapkanSaldo(k, tahun, profile?.email || "");
                    }
                    setPesan(`Kartu cuti dibuat untuk ${belumPunyaSaldo.length} karyawan.`);
                  } finally {
                    setSibuk(false);
                  }
                }}
              >
                Buat kartu cuti {tahun}
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="tabel-padat">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th className="text-right">Jatah</th>
                  <th className="text-right">Penyesuaian</th>
                  <th className="text-right">Terpakai</th>
                  <th className="text-right">Sisa cuti</th>
                  <th className="text-right">Sakit terpakai</th>
                  <th className="text-right">Sisa sakit</th>
                  <th>Catatan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {saldo.map((s) => (
                  <tr key={s.id}>
                    <td className="max-w-[190px]">
                      <p className="truncate font-semibold text-ink">{s.employeeName}</p>
                      <p className="text-[10px] text-muted">{s.employeeId}</p>
                    </td>
                    <td className="text-right">{s.jatahTahunan}</td>
                    <td className="text-right">{s.penyesuaian}</td>
                    <td className="text-right">{s.tahunanTerpakai}</td>
                    <td className="text-right font-semibold text-ink">{sisaTahunan(s)}</td>
                    <td className="text-right">{s.sakitTerpakai}</td>
                    <td className="text-right">{sisaSakit(s)}</td>
                    <td className="max-w-[200px]">
                      <p className="truncate text-muted" title={s.catatan}>
                        {s.catatan || "—"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button
                        className="btn-kuning"
                        onClick={() => {
                          setUbahSaldoUntuk(s);
                          setUJatah(String(s.jatahTahunan));
                          setUPenyesuaian(String(s.penyesuaian));
                          setUCatatan(s.catatan || "");
                        }}
                      >
                        Ubah
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-muted">
            Kolom Penyesuaian dipakai untuk memasukkan sisa cuti berjalan saat sistem mulai dipakai,
            atau membetulkan saldo. Angka Terpakai bergerak sendiri mengikuti pengajuan yang
            disetujui.
          </p>
        </>
      )}

      {/* Keputusan */}
      <Modal
        judul={putus ? `Putuskan · ${putus.employeeName}` : ""}
        terbuka={Boolean(putus)}
        onTutup={() => setPutus(null)}
      >
        {putus && (
          <div className="space-y-4">
            {salah && <Pesan jenis="gagal" isi={salah} />}

            <div className="rounded-lg bg-surface p-3 text-sm">
              <p className="font-semibold text-ink">
                {JENIS_CUTI[putus.jenis]?.label || putus.jenis} · {putus.jumlahHari || "—"} hari
              </p>
              <p className="mt-1 text-muted">
                {putus.tanggalMulai}
                {putus.tanggalSelesai !== putus.tanggalMulai && ` sampai ${putus.tanggalSelesai}`}
                {putus.jamKeluar && ` · ${putus.jamKeluar}–${putus.jamKembali}`}
              </p>
              <p className="mt-2 text-muted">{putus.alasan}</p>
              {putus.mendesak && (
                <p className="mt-2 text-xs font-semibold text-allegro-700">
                  Diajukan sebagai keadaan mendesak.
                </p>
              )}
              {putus.lampiranUrl && (
                <a
                  href={putus.lampiranUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs underline decoration-line underline-offset-2"
                >
                  Lihat lampiran
                </a>
              )}
            </div>

            {JENIS_CUTI[putus.jenis]?.potongSaldo && (
              <p className="text-xs text-muted">
                Jenis ini memotong saldo cuti tahunan. Saldo dipotong begitu disetujui, dan
                dikembalikan bila nanti dibatalkan.
              </p>
            )}

            <Field label="Catatan keputusan">
              <textarea
                className="input-dasar"
                rows={2}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />
            </Field>

            <div className="flex gap-2">
              <button
                className="btn-utama flex-1"
                disabled={sibuk}
                onClick={() => simpanKeputusan("DISETUJUI")}
              >
                Setujui
              </button>
              <button
                className="btn-ringan text-bahaya"
                disabled={sibuk}
                onClick={() => simpanKeputusan("DITOLAK")}
              >
                Tolak
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Ubah saldo */}
      <Modal
        judul={ubahSaldoUntuk ? `Saldo · ${ubahSaldoUntuk.employeeName}` : ""}
        terbuka={Boolean(ubahSaldoUntuk)}
        onTutup={() => setUbahSaldoUntuk(null)}
      >
        {ubahSaldoUntuk && (
          <div className="space-y-4">
            <Field label="Jatah tahunan" bantuan="Bawaannya 12 hari, nol bila belum genap setahun bekerja.">
              <input
                className="input-dasar max-w-[8rem]"
                inputMode="numeric"
                value={uJatah}
                onChange={(e) => setUJatah(e.target.value.replace(/[^\d-]/g, ""))}
              />
            </Field>
            <Field label="Penyesuaian" bantuan="Boleh minus. Dipakai untuk saldo awal atau koreksi.">
              <input
                className="input-dasar max-w-[8rem]"
                inputMode="numeric"
                value={uPenyesuaian}
                onChange={(e) => setUPenyesuaian(e.target.value.replace(/[^\d-]/g, ""))}
              />
            </Field>
            <Field label="Catatan" wajib>
              <input
                className="input-dasar"
                value={uCatatan}
                onChange={(e) => setUCatatan(e.target.value)}
                placeholder="Saldo awal dari catatan HR per 1 Januari"
              />
            </Field>
            <button
              className="btn-utama w-full"
              disabled={sibuk}
              onClick={async () => {
                if (!uCatatan.trim()) return setSalah("Catatan wajib diisi agar perubahan saldo jelas alasannya.");
                setSibuk(true);
                try {
                  await ubahSaldo(ubahSaldoUntuk.id, {
                    jatahTahunan: Number(uJatah) || 0,
                    penyesuaian: Number(uPenyesuaian) || 0,
                    catatan: uCatatan.trim(),
                  });
                  setUbahSaldoUntuk(null);
                  setPesan("Saldo diperbarui.");
                } finally {
                  setSibuk(false);
                }
              }}
            >
              Simpan saldo
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function HalamanKelolaCuti() {
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER"]}>
      <Shell judul="Kelola Cuti & Izin" keterangan="Pengajuan yang masuk dan saldo cuti karyawan." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
