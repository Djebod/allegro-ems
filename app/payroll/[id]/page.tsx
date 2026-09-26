"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import {
  ambilPayroll,
  hapusPayroll,
  hitungUlangPayroll,
  kembalikanKeDraft,
  majukanStatusPayroll,
  pantauItemPayroll,
  statusBerikut,
  ubahItemPayroll,
} from "@/lib/data";
import { eksporPayroll } from "@/lib/ekspor";
import { bacaAngka, keRupiah, rupiahPenuh } from "@/lib/rupiah";
import { tanggalPendek } from "@/lib/absensi";
import type { Payroll, PayrollItem, StatusPayroll } from "@/types";

function warnaStatus(s: StatusPayroll) {
  if (s === "LOCKED") return "bg-allegro-700 text-white";
  if (s === "PAID") return "bg-green-100 text-green-800";
  if (s === "APPROVED") return "bg-allegro-100 text-allegro-700";
  if (s === "REVIEW") return "bg-kuning-400/40 text-allegro-700";
  return "bg-surface text-muted";
}

const PENJELASAN: Record<StatusPayroll, string> = {
  DRAFT: "Masih bisa disesuaikan. Potongan dan tambahan boleh diubah.",
  REVIEW: "Sedang diperiksa. Masih bisa dikembalikan ke DRAFT bila ada yang keliru.",
  APPROVED: "Sudah disahkan. Potongan bon sudah dibukukan dan angkanya tidak bisa diubah lagi.",
  PAID: "Sudah dibayarkan kepada karyawan.",
  LOCKED: "Terkunci permanen. Tidak ada yang bisa mengubahnya.",
};

function Isi({ id }: { id: string }) {
  const { profile } = useAuth();
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const [ubah, setUbah] = useState<PayrollItem | null>(null);
  const [uTambahan, setUTambahan] = useState("");
  const [uBon, setUBon] = useState("");
  const [uLain, setULain] = useState("");
  const [uCatatan, setUCatatan] = useState("");

  const [konfirmasi, setKonfirmasi] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const [catatanUlang, setCatatanUlang] = useState<string[]>([]);

  async function muat() {
    setPayroll(await ambilPayroll(id));
  }

  useEffect(() => {
    muat().finally(() => setMemuat(false));
    return pantauItemPayroll(id, setItems, () =>
      setSalah("Rincian payroll tidak bisa dibaca. Periksa Security Rules.")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (memuat) return <p className="text-muted">Memuat…</p>;

  if (!payroll)
    return (
      <div className="kartu">
        <p className="text-sm text-muted">Payroll tidak ditemukan.</p>
        <Link href="/payroll" className="btn-ringan mt-4 inline-flex">
          Kembali ke daftar
        </Link>
      </div>
    );

  const bisaDiubah = payroll.status === "DRAFT" || payroll.status === "REVIEW";
  const berikut = statusBerikut(payroll.status);
  const adaMinus = items.some((i) => i.netPay <= 0);

  function bukaUbah(item: PayrollItem) {
    setUbah(item);
    setUTambahan(keRupiah(item.additionalPay || 0));
    setUBon(keRupiah(item.loanDeduction || 0));
    setULain(keRupiah(item.otherDeduction || 0));
    setUCatatan(item.catatan || "");
    setSalah(null);
  }

  async function simpanUbah() {
    if (!ubah) return;
    setSibuk(true);
    setSalah(null);
    try {
      await ubahItemPayroll(ubah, {
        additionalPay: bacaAngka(uTambahan),
        loanDeduction: bacaAngka(uBon),
        otherDeduction: bacaAngka(uLain),
        catatan: uCatatan.trim(),
      });
      await muat();
      setUbah(null);
      setPesan("Baris diperbarui.");
    } catch {
      setSalah("Perubahan gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function majukan() {
    setSibuk(true);
    setSalah(null);
    try {
      const baru = await majukanStatusPayroll(payroll!, profile?.email || "");
      await muat();
      setKonfirmasi(false);
      setPesan(
        baru === "APPROVED"
          ? "Payroll disahkan. Potongan bon sudah dibukukan sebagai pembayaran."
          : `Status payroll sekarang ${baru}.`
      );
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Status gagal diubah.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="kartu">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted">
              {payroll.projectId} · {payroll.sectionName}
            </p>
            <h2 className="text-lg font-bold text-ink">
              {tanggalPendek(payroll.periodStart)} – {tanggalPendek(payroll.periodEnd)}
            </h2>
            <p className="mt-1 text-sm text-muted">{PENJELASAN[payroll.status]}</p>
          </div>
          <span className={`label-status ${warnaStatus(payroll.status)}`}>{payroll.status}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-4">
          <div>
            <p className="text-[11px] text-muted">Jumlah karyawan</p>
            <p className="text-lg font-bold leading-tight text-ink">{payroll.totalEmployees}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Upah kotor</p>
            <p className="text-lg font-bold leading-tight text-ink">
              {rupiahPenuh(payroll.totalGrossPay)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Potongan bon</p>
            <p className="text-lg font-bold leading-tight text-ink">
              {rupiahPenuh(payroll.totalLoanDeduction)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Potongan lain</p>
            <p className="text-lg font-bold leading-tight text-ink">
              {rupiahPenuh(payroll.totalOtherDeduction)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Dibayarkan</p>
            <p className="text-lg font-bold leading-tight text-allegro-700">
              {rupiahPenuh(payroll.totalNetPay)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          {berikut && (
            <button
              className="btn-utama"
              disabled={sibuk}
              onClick={() => (berikut === "APPROVED" ? setKonfirmasi(true) : majukan())}
            >
              {berikut === "REVIEW" && "Ajukan untuk diperiksa"}
              {berikut === "APPROVED" && "Sahkan payroll"}
              {berikut === "PAID" && "Tandai sudah dibayarkan"}
              {berikut === "LOCKED" && "Kunci permanen"}
            </button>
          )}

          {payroll.status === "REVIEW" && (
            <button
              className="btn-ringan"
              disabled={sibuk}
              onClick={async () => {
                await kembalikanKeDraft(payroll!);
                await muat();
                setPesan("Dikembalikan ke DRAFT.");
              }}
            >
              Kembalikan ke DRAFT
            </button>
          )}

          <button
            className="btn-kuning"
            disabled={items.length === 0}
            onClick={() =>
              eksporPayroll({
                payroll: payroll!,
                items,
                dibuatOleh: profile?.name || profile?.email || "",
              })
            }
          >
            Export Excel
          </button>

          {payroll.status === "DRAFT" && (
            <>
              <button
                className="btn-ringan"
                disabled={sibuk}
                onClick={async () => {
                  setSibuk(true);
                  setSalah(null);
                  setCatatanUlang([]);
                  try {
                    const hasil = await hitungUlangPayroll(payroll!);
                    await muat();
                    setCatatanUlang(hasil.masalah);
                    setPesan(`Dihitung ulang dari absensi terbaru · ${hasil.jumlah} karyawan.`);
                  } catch (e) {
                    setSalah(e instanceof Error ? e.message : "Gagal menghitung ulang.");
                  } finally {
                    setSibuk(false);
                  }
                }}
              >
                Hitung ulang
              </button>

              <button
                className="btn-ringan text-bahaya"
                disabled={sibuk}
                onClick={() => setKonfirmasiHapus(true)}
              >
                Hapus payroll
              </button>
            </>
          )}

          <Link href="/payroll" className="btn-ringan">
            Daftar payroll
          </Link>
        </div>

        {payroll.status !== "DRAFT" && payroll.status !== "REVIEW" && (
          <p className="mt-3 text-xs text-muted">
            Payroll yang sudah disahkan tidak bisa diubah maupun dihapus. Ini catatan pembayaran
            upah, jadi jejaknya harus tetap ada.
          </p>
        )}
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

      {adaMinus && (
        <div className="mt-4">
          <Pesan
            jenis="gagal"
            isi="Ada karyawan yang upah bersihnya nol atau minus karena potongan. Periksa kembali sebelum disahkan."
          />
        </div>
      )}

      {catatanUlang.length > 0 && (
        <details className="kartu mt-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Catatan perhitungan ({catatanUlang.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {catatanUlang.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="tabel-padat">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Mode</th>
              <th className="text-right">Hari</th>
              <th className="text-right">Jam</th>
              <th className="text-right">Lembur</th>
              <th className="text-right">Tarif</th>
              <th className="text-right">Upah pokok</th>
              <th className="text-right">Upah lembur</th>
              <th className="text-right">Tambahan</th>
              <th className="text-right">Kotor</th>
              <th className="text-right">Bon</th>
              <th className="text-right">Potongan lain</th>
              <th className="text-right">Bersih</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="max-w-[180px]">
                  <p className="truncate font-semibold text-ink" title={i.employeeName}>
                    {i.employeeName}
                  </p>
                  <p className="text-[10px] text-muted">
                    {i.employeeId} · {i.position}
                  </p>
                </td>
                <td>
                  {i.paymentMode}
                  {i.tarifBerubahDiPeriode && (
                    <span
                      className="ml-1 inline-block h-2 w-2 rounded-full bg-kuning-500 align-middle"
                      title="Tarif berubah di tengah periode; tiap hari dihitung dengan tarif yang berlaku hari itu."
                    />
                  )}
                </td>
                <td className="text-right">{i.totalWorkDays}</td>
                <td className="text-right">{i.totalWorkHours}</td>
                <td className="text-right">
                  {i.totalOvertimeHours}
                  {i.lemburGugurJam > 0 && (
                    <span className="ml-1 text-[10px] text-bahaya" title="Lembur gugur karena kurang dari batas minimum">
                      (−{i.lemburGugurJam})
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap text-right text-muted">
                  {i.paymentMode === "DAILY" ? keRupiah(i.dailyRate) : keRupiah(i.hourlyRate)}
                </td>
                <td className="whitespace-nowrap text-right">{keRupiah(i.regularPay)}</td>
                <td className="whitespace-nowrap text-right">{keRupiah(i.overtimePay)}</td>
                <td className="whitespace-nowrap text-right">{keRupiah(i.additionalPay || 0)}</td>
                <td className="whitespace-nowrap text-right">{keRupiah(i.grossPay)}</td>
                <td className="whitespace-nowrap text-right text-muted">
                  {keRupiah(i.loanDeduction)}
                </td>
                <td className="whitespace-nowrap text-right text-muted">
                  {keRupiah(i.otherDeduction)}
                </td>
                <td
                  className={`whitespace-nowrap text-right font-semibold ${
                    i.netPay <= 0 ? "text-bahaya" : "text-ink"
                  }`}
                >
                  {keRupiah(i.netPay)}
                </td>
                <td className="whitespace-nowrap text-right">
                  {bisaDiubah && (
                    <button className="btn-kuning" onClick={() => bukaUbah(i)}>
                      Ubah
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-muted">
        Angka jam dan tarif tidak bisa diubah di sini — keduanya berasal dari absensi yang sudah
        divalidasi dan dari tarif yang berlaku pada hari itu. Yang bisa disesuaikan hanya tambahan
        dan potongan.
      </p>

      {/* Ubah satu baris */}
      <Modal
        judul={ubah ? `Sesuaikan · ${ubah.employeeName}` : ""}
        terbuka={Boolean(ubah)}
        onTutup={() => setUbah(null)}
      >
        {ubah && (
          <div className="space-y-4">
            {salah && <Pesan jenis="gagal" isi={salah} />}

            <div className="rounded-lg bg-surface p-3 text-sm text-muted">
              Upah pokok {rupiahPenuh(ubah.regularPay)} · lembur {rupiahPenuh(ubah.overtimePay)}
            </div>

            <Field label="Tambahan" bantuan="Uang makan, bonus, atau tambahan lain.">
              <input
                className="input-dasar"
                inputMode="numeric"
                value={uTambahan}
                onChange={(e) => setUTambahan(keRupiah(bacaAngka(e.target.value)))}
              />
            </Field>

            <Field label="Potongan bon" bantuan="Dibukukan sebagai pembayaran bon saat payroll disahkan.">
              <input
                className="input-dasar"
                inputMode="numeric"
                value={uBon}
                onChange={(e) => setUBon(keRupiah(bacaAngka(e.target.value)))}
              />
            </Field>

            <Field label="Potongan lain">
              <input
                className="input-dasar"
                inputMode="numeric"
                value={uLain}
                onChange={(e) => setULain(keRupiah(bacaAngka(e.target.value)))}
              />
            </Field>

            <Field label="Catatan">
              <input
                className="input-dasar"
                value={uCatatan}
                onChange={(e) => setUCatatan(e.target.value)}
              />
            </Field>

            <div className="rounded-lg bg-allegro-50 p-3 text-sm font-semibold text-allegro-700">
              Bersih menjadi{" "}
              {rupiahPenuh(
                ubah.regularPay +
                  ubah.overtimePay +
                  bacaAngka(uTambahan) -
                  bacaAngka(uBon) -
                  bacaAngka(uLain)
              )}
            </div>

            <button className="btn-utama w-full" onClick={simpanUbah} disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        )}
      </Modal>

      {/* Konfirmasi hapus */}
      <Modal
        judul="Hapus payroll ini"
        terbuka={konfirmasiHapus}
        onTutup={() => setKonfirmasiHapus(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Seluruh rincian {payroll.totalEmployees} karyawan pada periode ini akan dihapus dan
            tidak bisa dikembalikan. Data absensi, tarif, dan bon tidak tersentuh — jadi periode
            ini bisa dihitung ulang kapan saja dari awal.
          </p>
          <p className="text-sm text-muted">
            Kalau yang keliru cuma angkanya, <strong className="text-ink">Hitung ulang</strong>{" "}
            lebih tepat daripada menghapus.
          </p>
          <div className="flex gap-2">
            <button
              className="btn-utama flex-1"
              disabled={sibuk}
              onClick={async () => {
                setSibuk(true);
                setSalah(null);
                try {
                  await hapusPayroll(payroll!);
                  window.location.href = "/payroll";
                } catch (e) {
                  setSalah(e instanceof Error ? e.message : "Payroll gagal dihapus.");
                  setKonfirmasiHapus(false);
                } finally {
                  setSibuk(false);
                }
              }}
            >
              {sibuk ? "Menghapus…" : "Ya, hapus"}
            </button>
            <button className="btn-ringan" onClick={() => setKonfirmasiHapus(false)}>
              Batal
            </button>
          </div>
        </div>
      </Modal>

      {/* Konfirmasi pengesahan */}
      <Modal judul="Sahkan payroll" terbuka={konfirmasi} onTutup={() => setKonfirmasi(false)}>
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Setelah disahkan, angka payroll tidak bisa diubah lagi dan potongan bon langsung
            dibukukan sebagai pembayaran pada bon karyawan yang bersangkutan.
          </p>
          <div className="rounded-lg bg-surface p-3 text-sm">
            <p>
              {payroll.totalEmployees} karyawan · dibayarkan{" "}
              <strong className="text-ink">{rupiahPenuh(payroll.totalNetPay)}</strong>
            </p>
            <p className="mt-1 text-muted">
              Potongan bon {rupiahPenuh(payroll.totalLoanDeduction)}
            </p>
          </div>
          {adaMinus && (
            <Pesan
              jenis="gagal"
              isi="Masih ada karyawan yang upah bersihnya nol atau minus. Sebaiknya diperiksa dulu."
            />
          )}
          <button className="btn-utama w-full" onClick={majukan} disabled={sibuk}>
            {sibuk ? "Memproses…" : "Ya, sahkan payroll"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default function HalamanDetailPayroll() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params.id));

  return (
    <Guard izinkan={["ADMIN", "FINANCE"]}>
      <Shell judul="Rincian Payroll" keterangan="Perhitungan upah per karyawan." lebar>
        <Isi id={id} />
      </Shell>
    </Guard>
  );
}
