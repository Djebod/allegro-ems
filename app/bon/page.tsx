"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import {
  batalkanBon,
  buatBon,
  catatPembayaranBon,
  daftarKaryawanAktif,
  pantauBon,
  pantauPembayaranBon,
} from "@/lib/data";
import { bacaAngka, keRupiah, rupiahPenuh } from "@/lib/rupiah";
import { tanggalHariIni, tanggalPendek } from "@/lib/absensi";
import type { Employee, EmployeeLoan, LoanRepayment, StatusBon } from "@/types";

const SARINGAN: { nilai: "BERJALAN" | "SEMUA" | StatusBon; label: string }[] = [
  { nilai: "BERJALAN", label: "Masih berjalan" },
  { nilai: "PAID", label: "Sudah lunas" },
  { nilai: "CANCELLED", label: "Dibatalkan" },
  { nilai: "SEMUA", label: "Semua" },
];

function warnaStatus(s: StatusBon) {
  if (s === "PAID") return "bg-green-100 text-green-800";
  if (s === "CANCELLED") return "bg-surface text-muted";
  if (s === "PARTIALLY_PAID") return "bg-kuning-400/40 text-allegro-700";
  return "bg-allegro-100 text-allegro-700";
}

function labelStatus(s: StatusBon) {
  if (s === "PAID") return "LUNAS";
  if (s === "CANCELLED") return "DIBATALKAN";
  if (s === "PARTIALLY_PAID") return "SEBAGIAN";
  return "BERJALAN";
}

function Isi() {
  const { profile } = useAuth();
  const [bon, setBon] = useState<EmployeeLoan[]>([]);
  const [karyawan, setKaryawan] = useState<Employee[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [saring, setSaring] = useState<"BERJALAN" | "SEMUA" | StatusBon>("BERJALAN");
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const [bukaBaru, setBukaBaru] = useState(false);
  const [pKaryawan, setPKaryawan] = useState("");
  const [pJumlah, setPJumlah] = useState("");
  const [pTanggal, setPTanggal] = useState(tanggalHariIni());
  const [pKeterangan, setPKeterangan] = useState("");

  const [bayarUntuk, setBayarUntuk] = useState<EmployeeLoan | null>(null);
  const [bJumlah, setBJumlah] = useState("");
  const [bCatatan, setBCatatan] = useState("");
  const [riwayat, setRiwayat] = useState<LoanRepayment[]>([]);

  const [batalUntuk, setBatalUntuk] = useState<EmployeeLoan | null>(null);
  const [alasanBatal, setAlasanBatal] = useState("");

  useEffect(() => {
    daftarKaryawanAktif().then(setKaryawan).catch(() => {});
    return pantauBon(
      (d) => {
        setBon(d);
        setMemuat(false);
      },
      () => {
        setSalah("Data bon tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
        setMemuat(false);
      }
    );
  }, []);

  useEffect(() => {
    if (!bayarUntuk) {
      setRiwayat([]);
      return;
    }
    return pantauPembayaranBon(bayarUntuk.id, setRiwayat, () => setRiwayat([]));
  }, [bayarUntuk]);

  const terlihat = useMemo(() => {
    const k = cari.trim().toLowerCase();
    return bon
      .filter((b) =>
        saring === "SEMUA"
          ? true
          : saring === "BERJALAN"
          ? b.status === "OPEN" || b.status === "PARTIALLY_PAID"
          : b.status === saring
      )
      .filter(
        (b) =>
          !k || b.employeeName.toLowerCase().includes(k) || b.employeeId.toLowerCase().includes(k)
      );
  }, [bon, saring, cari]);

  const totalBerjalan = useMemo(
    () =>
      bon
        .filter((b) => b.status === "OPEN" || b.status === "PARTIALLY_PAID")
        .reduce((t, b) => t + b.remainingAmount, 0),
    [bon]
  );

  async function simpanBonBaru() {
    setSalah(null);
    const orang = karyawan.find((k) => k.id === pKaryawan);
    if (!orang) return setSalah("Karyawan wajib dipilih.");
    const jumlah = bacaAngka(pJumlah);
    if (jumlah <= 0) return setSalah("Nominal bon wajib diisi.");

    setSibuk(true);
    try {
      await buatBon({
        karyawan: orang,
        jumlah,
        tanggal: pTanggal,
        keterangan: pKeterangan.trim(),
        oleh: profile?.email || "",
      });
      setBukaBaru(false);
      setPKaryawan("");
      setPJumlah("");
      setPKeterangan("");
      setPesan(`Bon ${rupiahPenuh(jumlah)} untuk ${orang.name} tersimpan.`);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Bon gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function simpanPembayaran() {
    if (!bayarUntuk) return;
    setSalah(null);
    const jumlah = bacaAngka(bJumlah);
    setSibuk(true);
    try {
      const hasil = await catatPembayaranBon({
        bon: bayarUntuk,
        jumlah,
        catatan: bCatatan.trim(),
        payrollId: null,
        oleh: profile?.email || "",
      });
      setBayarUntuk(null);
      setBJumlah("");
      setBCatatan("");
      setPesan(
        hasil.sisa === 0
          ? "Bon lunas. Karyawan ini sekarang boleh mengajukan bon baru."
          : `Pembayaran tercatat. Sisa bon ${rupiahPenuh(hasil.sisa)}.`
      );
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Pembayaran gagal dicatat.");
    } finally {
      setSibuk(false);
    }
  }

  async function simpanPembatalan() {
    if (!batalUntuk) return;
    setSalah(null);
    if (!alasanBatal.trim()) return setSalah("Alasan pembatalan wajib diisi.");
    setSibuk(true);
    try {
      await batalkanBon(batalUntuk, alasanBatal.trim(), profile?.email || "");
      setBatalUntuk(null);
      setAlasanBatal("");
      setPesan("Bon dibatalkan.");
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Bon gagal dibatalkan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button className="btn-utama" onClick={() => setBukaBaru(true)}>
          Bon baru
        </button>
        <input
          className="input-dasar max-w-xs"
          placeholder="Cari nama atau kode"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <select
          className="input-dasar max-w-[12rem]"
          value={saring}
          onChange={(e) => setSaring(e.target.value as typeof saring)}
        >
          {SARINGAN.map((s) => (
            <option key={s.nilai} value={s.nilai}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="ml-auto rounded-xl border border-line bg-white px-4 py-2">
          <p className="text-[11px] text-muted">Total bon berjalan</p>
          <p className="text-lg font-bold leading-tight text-ink">{rupiahPenuh(totalBerjalan)}</p>
        </div>
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

      {memuat ? (
        <p className="text-muted">Memuat…</p>
      ) : terlihat.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">
            {bon.length === 0
              ? "Belum ada bon tercatat."
              : "Tidak ada bon yang cocok dengan saringan ini."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tabel-padat">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Tanggal</th>
                <th className="text-right">Nominal bon</th>
                <th className="text-right">Sudah dibayar</th>
                <th className="text-right">Sisa</th>
                <th>Status</th>
                <th>Keterangan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {terlihat.map((b) => {
                const berjalan = b.status === "OPEN" || b.status === "PARTIALLY_PAID";
                return (
                  <tr key={b.id}>
                    <td className="max-w-[190px]">
                      <p className="truncate font-semibold text-ink" title={b.employeeName}>
                        {b.employeeName}
                      </p>
                      <p className="text-[10px] text-muted">{b.employeeId}</p>
                    </td>
                    <td className="whitespace-nowrap">{tanggalPendek(b.loanDate)}</td>
                    <td className="whitespace-nowrap text-right">{keRupiah(b.originalAmount)}</td>
                    <td className="whitespace-nowrap text-right text-muted">
                      {keRupiah(b.originalAmount - b.remainingAmount)}
                    </td>
                    <td className="whitespace-nowrap text-right font-semibold text-ink">
                      {keRupiah(b.remainingAmount)}
                    </td>
                    <td>
                      <span className={`label-status ${warnaStatus(b.status)}`}>
                        {labelStatus(b.status)}
                      </span>
                    </td>
                    <td className="max-w-[220px]">
                      <p className="truncate text-muted" title={b.description}>
                        {b.description || "—"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {berjalan && (
                        <>
                          <button className="btn-kuning" onClick={() => setBayarUntuk(b)}>
                            Bayar
                          </button>
                          <button
                            className="btn-ringan ml-2 px-2 py-1 text-[11px]"
                            onClick={() => setBatalUntuk(b)}
                          >
                            Batalkan
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-muted">
        Satu karyawan hanya boleh punya satu bon berjalan. Bon baru bisa dibuat setelah bon
        sebelumnya lunas atau dibatalkan.
      </p>

      {/* Bon baru */}
      <Modal judul="Bon baru" terbuka={bukaBaru} onTutup={() => setBukaBaru(false)}>
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <Field label="Karyawan" wajib>
            <select
              className="input-dasar"
              value={pKaryawan}
              onChange={(e) => setPKaryawan(e.target.value)}
            >
              <option value="">— pilih karyawan —</option>
              {karyawan.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({k.employeeCode})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nominal bon" wajib>
            <input
              className="input-dasar"
              inputMode="numeric"
              value={pJumlah}
              onChange={(e) => setPJumlah(keRupiah(bacaAngka(e.target.value)))}
              placeholder="500.000"
            />
          </Field>

          <Field label="Tanggal bon" wajib>
            <input
              type="date"
              className="input-dasar"
              value={pTanggal}
              onChange={(e) => setPTanggal(e.target.value)}
            />
          </Field>

          <Field label="Keterangan">
            <textarea
              className="input-dasar"
              rows={2}
              value={pKeterangan}
              onChange={(e) => setPKeterangan(e.target.value)}
              placeholder="Keperluan berobat anak"
            />
          </Field>

          <button className="btn-utama w-full" onClick={simpanBonBaru} disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan bon"}
          </button>
        </div>
      </Modal>

      {/* Pembayaran */}
      <Modal
        judul={bayarUntuk ? `Bayar bon · ${bayarUntuk.employeeName}` : ""}
        terbuka={Boolean(bayarUntuk)}
        onTutup={() => setBayarUntuk(null)}
      >
        {bayarUntuk && (
          <div className="space-y-4">
            {salah && <Pesan jenis="gagal" isi={salah} />}

            <div className="rounded-lg bg-surface p-3 text-sm">
              <p className="text-muted">
                Nominal bon {rupiahPenuh(bayarUntuk.originalAmount)} · sisa{" "}
                <strong className="text-ink">{rupiahPenuh(bayarUntuk.remainingAmount)}</strong>
              </p>
            </div>

            <Field label="Jumlah pembayaran" wajib>
              <input
                className="input-dasar"
                inputMode="numeric"
                value={bJumlah}
                onChange={(e) => setBJumlah(keRupiah(bacaAngka(e.target.value)))}
              />
            </Field>

            <button
              className="btn-ringan"
              onClick={() => setBJumlah(keRupiah(bayarUntuk.remainingAmount))}
            >
              Isi sejumlah sisa bon
            </button>

            <Field label="Catatan">
              <input
                className="input-dasar"
                value={bCatatan}
                onChange={(e) => setBCatatan(e.target.value)}
                placeholder="Dibayar tunai"
              />
            </Field>

            {riwayat.length > 0 && (
              <details className="rounded-lg border border-line p-3">
                <summary className="cursor-pointer text-sm font-medium text-ink">
                  Riwayat pembayaran ({riwayat.length})
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {riwayat.map((r) => (
                    <li key={r.id}>
                      {rupiahPenuh(r.amount)}
                      {r.payrollId ? " · potongan payroll" : " · di luar payroll"}
                      {r.catatan ? ` · ${r.catatan}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <button className="btn-utama w-full" onClick={simpanPembayaran} disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Catat pembayaran"}
            </button>
          </div>
        )}
      </Modal>

      {/* Pembatalan */}
      <Modal
        judul={batalUntuk ? `Batalkan bon · ${batalUntuk.employeeName}` : ""}
        terbuka={Boolean(batalUntuk)}
        onTutup={() => setBatalUntuk(null)}
      >
        {batalUntuk && (
          <div className="space-y-4">
            {salah && <Pesan jenis="gagal" isi={salah} />}
            <p className="text-sm text-muted">
              Bon dibatalkan, bukan dihapus. Catatannya tetap ada dan sisa{" "}
              {rupiahPenuh(batalUntuk.remainingAmount)} dianggap tidak ditagih.
            </p>
            <Field label="Alasan pembatalan" wajib>
              <textarea
                className="input-dasar"
                rows={2}
                value={alasanBatal}
                onChange={(e) => setAlasanBatal(e.target.value)}
                placeholder="Salah input nominal"
              />
            </Field>
            <button className="btn-utama w-full" onClick={simpanPembatalan} disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Batalkan bon"}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function HalamanBon() {
  return (
    <Guard izinkan={["ADMIN", "FINANCE"]}>
      <Shell
        judul="Bon Karyawan"
        keterangan="Pinjaman karyawan dan pelunasannya."
        lebar
      >
        <Isi />
      </Shell>
    </Guard>
  );
}
