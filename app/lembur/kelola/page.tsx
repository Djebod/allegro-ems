"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { daftarKaryawanAktif } from "@/lib/data";
import { ajukanLembur, pantauSemuaLembur, putuskanLembur } from "@/lib/data-lembur";
import { NAMA_STATUS_LEMBUR, hitungJamLembur, masihBolehDiajukan } from "@/lib/lembur";
import { BATAS_AJUKAN_LEMBUR_HARI } from "@/lib/constants";
import { tanggalHariIni, tanggalPendek } from "@/lib/absensi";
import type { Employee, PengajuanLembur, StatusPengajuan } from "@/types";

function warnaStatus(s: StatusPengajuan) {
  if (s === "DISETUJUI") return "bg-green-100 text-green-800";
  if (s === "DITOLAK") return "bg-red-100 text-bahaya";
  if (s === "DIBATALKAN") return "bg-surface text-muted";
  return "bg-kuning-400/40 text-allegro-700";
}

const SUMBER: Record<PengajuanLembur["sumber"], string> = {
  SENDIRI: "sendiri",
  MANDOR: "oleh mandor",
  PENGELOLA: "oleh pengelola",
};

function Isi() {
  const { profile } = useAuth();
  const hariIni = tanggalHariIni();
  // Finance hanya membaca; keputusan dan pengajuan atas nama tetap HR/Owner/Admin.
  const bolehMemutuskan = profile?.role === "ADMIN" || profile?.role === "HR" || profile?.role === "OWNER";

  const [pengajuan, setPengajuan] = useState<PengajuanLembur[]>([]);
  const [karyawan, setKaryawan] = useState<Employee[]>([]);
  const [saring, setSaring] = useState<"SEMUA" | StatusPengajuan>("DIAJUKAN");
  const [bulan, setBulan] = useState("");
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const [putus, setPutus] = useState<PengajuanLembur | null>(null);
  const [catatan, setCatatan] = useState("");
  const [jamDisetujui, setJamDisetujui] = useState("");

  const [bukaAtasNama, setBukaAtasNama] = useState(false);
  const [aKaryawan, setAKaryawan] = useState("");
  const [aTanggal, setATanggal] = useState(hariIni);
  const [aMulai, setAMulai] = useState("17:00");
  const [aSelesai, setASelesai] = useState("19:00");
  const [aAlasan, setAAlasan] = useState("");

  useEffect(() => {
    daftarKaryawanAktif().then(setKaryawan).catch(() => {});
    return pantauSemuaLembur(setPengajuan, () =>
      setSalah("Data pengajuan lembur tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.")
    );
  }, []);

  const terlihat = useMemo(
    () =>
      pengajuan
        .filter((p) => saring === "SEMUA" || p.status === saring)
        .filter((p) => !bulan || p.tanggal.startsWith(bulan)),
    [pengajuan, saring, bulan]
  );

  const totalJamTerlihat = useMemo(
    () =>
      Math.round(
        terlihat.reduce((t, p) => t + (p.status === "DISETUJUI" ? p.jamDisetujui ?? p.jamLembur : 0), 0) * 100
      ) / 100,
    [terlihat]
  );

  async function simpanKeputusan(status: "DISETUJUI" | "DITOLAK") {
    if (!putus) return;
    setSibuk(true);
    setSalah(null);
    try {
      await putuskanLembur({
        pengajuan: putus,
        status,
        catatan,
        jamDisetujui: Number(jamDisetujui.replace(",", ".")) || 0,
        oleh: profile?.email || "",
      });
      setPutus(null);
      setCatatan("");
      setPesan(status === "DISETUJUI" ? "Lembur disetujui dan akan ikut dibayar di payroll." : "Pengajuan lembur ditolak.");
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Keputusan gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function kirimAtasNama() {
    setSalah(null);
    const target = karyawan.find((k) => k.id === aKaryawan);
    if (!target) return setSalah("Pilih karyawannya dulu.");
    setSibuk(true);
    try {
      await ajukanLembur({
        karyawan: target,
        tanggal: aTanggal,
        hariIni,
        jamMulai: aMulai,
        jamSelesai: aSelesai,
        alasan: aAlasan,
        lampiranUrl: null,
        sumber: "PENGELOLA",
        oleh: profile?.email || "",
      });
      setBukaAtasNama(false);
      setAAlasan("");
      setPesan(`Pengakuan lembur untuk ${target.name} dimasukkan dan menunggu persetujuan.`);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Pengajuan gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  const aTerlambat = /^\d{4}-\d{2}-\d{2}$/.test(aTanggal) && !masihBolehDiajukan(aTanggal, hariIni);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {bolehMemutuskan && (
          <button
            className="btn-utama"
            onClick={() => {
              setSalah(null);
              setBukaAtasNama(true);
            }}
          >
            Ajukan atas nama karyawan
          </button>
        )}
        <input
          type="month"
          className="input-dasar w-full sm:w-auto"
          value={bulan}
          onChange={(e) => setBulan(e.target.value)}
          title="Saring bulan"
        />
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

      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-line bg-white px-5 py-3">
        <div>
          <p className="text-[11px] text-muted">Pengajuan</p>
          <p className="text-lg font-bold leading-tight text-ink">{terlihat.length}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted">Jam disetujui (yang tampil)</p>
          <p className="text-lg font-bold leading-tight text-ink">{totalJamTerlihat} jam</p>
        </div>
        <div>
          <p className="text-[11px] text-muted">Batas pengajuan sendiri</p>
          <p className="text-lg font-bold leading-tight text-ink">{BATAS_AJUKAN_LEMBUR_HARI} hari</p>
        </div>
      </div>

      {terlihat.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">Tidak ada pengajuan lembur pada saringan ini.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tabel-padat">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Tanggal</th>
                <th>Jam</th>
                <th className="text-right">Diajukan</th>
                <th className="text-right">Disetujui</th>
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
                    <p className="text-[10px] text-muted">
                      {p.employeeId}
                      {p.divisi ? ` · ${p.divisi}` : ""} · {SUMBER[p.sumber]}
                    </p>
                  </td>
                  <td className="whitespace-nowrap">
                    {tanggalPendek(p.tanggal)}
                    {p.terlambat && (
                      <span className="ml-1 label-status bg-kuning-400/40 text-allegro-700" title="Diajukan lewat batas waktu">
                        terlambat
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {p.jamMulai}–{p.jamSelesai}
                  </td>
                  <td className="text-right">{p.jamLembur}</td>
                  <td className="text-right font-semibold text-ink">
                    {p.status === "DISETUJUI" ? (p.jamDisetujui ?? p.jamLembur) : "—"}
                  </td>
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
                    {p.catatanKeputusan && (
                      <p className="truncate text-[10px] text-muted" title={p.catatanKeputusan}>
                        {p.catatanKeputusan}
                      </p>
                    )}
                  </td>
                  <td>
                    <span className={`label-status ${warnaStatus(p.status)}`}>{NAMA_STATUS_LEMBUR[p.status]}</span>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {bolehMemutuskan && p.status === "DIAJUKAN" && (
                      <button
                        className="btn-kuning"
                        onClick={() => {
                          setSalah(null);
                          setPutus(p);
                          setCatatan("");
                          setJamDisetujui(String(p.jamLembur));
                        }}
                      >
                        Putuskan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-muted">
        Hanya lembur berstatus Disetujui yang dibayar. Payroll mingguan membayar yang terkecil antara jam yang
        disetujui dan jam lembur di absensi; untuk staf kantor, jam yang disetujui menjadi acuan HR mengisi kolom
        lembur di payroll bulanan.
      </p>

      {/* Keputusan */}
      <Modal judul={putus ? `Putuskan · ${putus.employeeName}` : ""} terbuka={Boolean(putus)} onTutup={() => setPutus(null)}>
        {putus && (
          <div className="space-y-4">
            {salah && <Pesan jenis="gagal" isi={salah} />}

            <div className="rounded-lg bg-surface p-3 text-sm">
              <p className="font-semibold text-ink">
                {putus.tanggal} · {putus.jamMulai}–{putus.jamSelesai} · {putus.jamLembur} jam
              </p>
              <p className="mt-2 text-muted">{putus.alasan}</p>
              <p className="mt-2 text-xs text-muted">
                Diajukan {SUMBER[putus.sumber]} ({putus.diajukanOleh})
                {putus.terlambat ? " · lewat batas waktu" : ""}
              </p>
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

            <Field
              label="Jam yang disetujui"
              wajib
              bantuan="Boleh dikurangi dari yang diajukan, tidak boleh ditambah."
            >
              <input
                className="input-dasar max-w-[8rem]"
                inputMode="decimal"
                value={jamDisetujui}
                onChange={(e) => setJamDisetujui(e.target.value.replace(/[^\d.,]/g, ""))}
              />
            </Field>

            <Field label="Catatan keputusan" bantuan="Wajib bila ditolak.">
              <textarea className="input-dasar" rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
            </Field>

            <div className="flex gap-2">
              <button className="btn-utama flex-1" disabled={sibuk} onClick={() => simpanKeputusan("DISETUJUI")}>
                Setujui
              </button>
              <button className="btn-ringan text-bahaya" disabled={sibuk} onClick={() => simpanKeputusan("DITOLAK")}>
                Tolak
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Ajukan atas nama */}
      <Modal judul="Ajukan lembur atas nama karyawan" terbuka={bukaAtasNama} onTutup={() => setBukaAtasNama(false)}>
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}
          <p className="text-xs text-muted">
            Untuk lembur yang lewat batas {BATAS_AJUKAN_LEMBUR_HARI} hari sehingga tidak bisa diajukan sendiri oleh
            karyawan. Tetap lahir sebagai Menunggu, lalu diputuskan seperti biasa.
          </p>

          <Field label="Karyawan" wajib>
            <select className="input-dasar" value={aKaryawan} onChange={(e) => setAKaryawan(e.target.value)}>
              <option value="">— pilih karyawan —</option>
              {karyawan.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({k.employeeCode}) · {k.position}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tanggal lembur" wajib>
            <input type="date" className="input-dasar" value={aTanggal} max={hariIni} onChange={(e) => setATanggal(e.target.value)} />
          </Field>
          {aTerlambat && (
            <p className="text-xs font-semibold text-allegro-700">
              Lewat batas pengajuan sendiri. Akan ditandai sebagai pengajuan terlambat.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jam mulai" wajib>
              <input type="time" className="input-dasar" value={aMulai} onChange={(e) => setAMulai(e.target.value)} />
            </Field>
            <Field label="Jam selesai" wajib>
              <input type="time" className="input-dasar" value={aSelesai} onChange={(e) => setASelesai(e.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-muted">
            Lama lembur <strong className="text-ink">{hitungJamLembur(aMulai, aSelesai)} jam</strong>.
          </p>

          <Field label="Alasan lembur" wajib>
            <textarea className="input-dasar" rows={3} value={aAlasan} onChange={(e) => setAAlasan(e.target.value)} />
          </Field>

          <button className="btn-utama w-full" onClick={kirimAtasNama} disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Masukkan pengajuan"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default function HalamanKelolaLembur() {
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER", "FINANCE"]}>
      <Shell judul="Kelola Lembur" keterangan="Pengakuan lembur yang masuk, keputusan, dan pengajuan atas nama karyawan." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
