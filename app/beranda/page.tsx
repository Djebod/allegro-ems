"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import FotoKaryawan from "@/components/FotoKaryawan";
import PerluTindakan, { punyaTindakan } from "@/components/PerluTindakan";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { dbClient } from "@/lib/firebase";
import { pantauAbsensiSaya, pantauBawahan, ubahDataPribadi, ubahFotoSaya } from "@/lib/data";
import { ambilSaldo, pantauCutiBawahan, pantauPengajuan } from "@/lib/data-cuti";
import { pantauSP } from "@/lib/data-sp";
import { pantauAbsenBawahan, pantauAbsenKantor } from "@/lib/data-kantor";
import { masihBerlaku } from "@/lib/sp";
import { sisaSakit, sisaTahunan, JENIS_CUTI } from "@/lib/cuti";
import { hariSabtu, jadwalUntuk } from "@/lib/jadwal";
import { jamEfektifKantor } from "@/lib/kantor";
import { cloudinarySiap, unggahFoto } from "@/lib/cloudinary";
import { hitungJam, jamDari, tanggalHariIni, tanggalPendek } from "@/lib/absensi";
import { FOLDER_PROFIL } from "@/lib/cloudinary";
import type {
  AbsenKantor,
  Attendance,
  Employee,
  HariLibur,
  PengajuanCuti,
  SaldoCuti,
  SuratPeringatan,
} from "@/types";

function sapaan(): string {
  const j = new Date().getHours();
  if (j < 11) return "Selamat pagi";
  if (j < 15) return "Selamat siang";
  if (j < 18) return "Selamat sore";
  return "Selamat malam";
}

function awalBulan(t: string) {
  return `${t.slice(0, 7)}-01`;
}

function Angka({
  label,
  nilai,
  keterangan,
  warna,
}: {
  label: string;
  nilai: string | number;
  keterangan?: string;
  warna?: string;
}) {
  return (
    <div className="kartu">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${warna || "text-ink"}`}>{nilai}</p>
      {keterangan && <p className="mt-1 text-[11px] text-muted">{keterangan}</p>}
    </div>
  );
}

function Isi() {
  const { profile } = useAuth();
  const employeeId = profile?.employeeId || "";
  const hariIni = tanggalHariIni();

  const [karyawan, setKaryawan] = useState<Employee | null>(null);
  const [libur, setLibur] = useState<HariLibur | null>(null);
  const [absenKantor, setAbsenKantor] = useState<AbsenKantor[]>([]);
  const [absenLapangan, setAbsenLapangan] = useState<Attendance[]>([]);
  const [saldo, setSaldo] = useState<SaldoCuti | null>(null);
  const [cuti, setCuti] = useState<PengajuanCuti[]>([]);
  const [sp, setSp] = useState<SuratPeringatan[]>([]);
  const [bawahan, setBawahan] = useState<Employee[]>([]);
  const [absenBawahan, setAbsenBawahan] = useState<AbsenKantor[]>([]);
  const [cutiBawahan, setCutiBawahan] = useState<PengajuanCuti[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [buka, setBuka] = useState(false);
  const [uNickname, setUNickname] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uAddress, setUAddress] = useState("");
  const [uBank, setUBank] = useState("");
  const [uRekening, setURekening] = useState("");
  const [uAtasNama, setUAtasNama] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  const muatKaryawan = useCallback(async () => {
    if (!employeeId) return;
    const snap = await getDoc(doc(dbClient(), "employees", employeeId));
    if (snap.exists()) setKaryawan({ id: snap.id, ...(snap.data() as Omit<Employee, "id">) });
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId) {
      setMemuat(false);
      return;
    }
    muatKaryawan().finally(() => setMemuat(false));
    // ID dokumen hari libur adalah tanggalnya, jadi cukup satu bacaan.
    getDoc(doc(dbClient(), "holidays", hariIni))
      .then((s) => setLibur(s.exists() ? { id: s.id, ...(s.data() as Omit<HariLibur, "id">) } : null))
      .catch(() => {});
    ambilSaldo(employeeId, Number(hariIni.slice(0, 4))).then(setSaldo).catch(() => {});

    const lepas = [
      pantauAbsenKantor(awalBulan(hariIni), hariIni, setAbsenKantor, () => {}, employeeId),
      pantauAbsensiSaya(employeeId, awalBulan(hariIni), hariIni, setAbsenLapangan, () => {}),
      pantauPengajuan(setCuti, () => {}, employeeId),
      pantauSP(setSp, () => {}, employeeId),
      pantauBawahan(employeeId, setBawahan, () => {}),
      pantauAbsenBawahan(employeeId, hariIni, hariIni, setAbsenBawahan, () => {}),
      pantauCutiBawahan(employeeId, setCutiBawahan, () => {}),
    ];
    return () => lepas.forEach((f) => f());
  }, [employeeId, hariIni, muatKaryawan]);

  const absenHariIni = useMemo(
    () => absenKantor.find((a) => a.date === hariIni) || null,
    [absenKantor, hariIni]
  );

  const rekapBulan = useMemo(() => {
    const jamKantor = absenKantor.reduce((t, a) => t + a.workHours, 0);
    const jamLapangan = absenLapangan.reduce((t, a) => t + hitungJam(a).workHours, 0);
    const telat = absenKantor.filter((a) => a.terlambatMenit > 0);
    return {
      hariHadir: absenKantor.length + absenLapangan.length,
      jamKerja: Math.round((jamKantor + jamLapangan) * 100) / 100,
      kejadianTelat: telat.length,
      menitTelat: telat.reduce((t, a) => t + a.terlambatMenit, 0),
      belumPulang: absenKantor.filter((a) => !a.pulang && a.date !== hariIni).length,
    };
  }, [absenKantor, absenLapangan, hariIni]);

  const spAktif = useMemo(() => sp.filter((x) => masihBerlaku(x, hariIni)), [sp, hariIni]);
  const cutiMenunggu = useMemo(() => cuti.filter((c) => c.status === "DIAJUKAN"), [cuti]);
  const cutiHariIni = useMemo(
    () =>
      cuti.find(
        (c) => c.status === "DISETUJUI" && c.tanggalMulai <= hariIni && c.tanggalSelesai >= hariIni
      ) || null,
    [cuti, hariIni]
  );
  const cutiBerikut = useMemo(
    () =>
      cuti
        .filter((c) => c.status === "DISETUJUI" && c.tanggalMulai >= hariIni)
        .sort((a, b) => a.tanggalMulai.localeCompare(b.tanggalMulai))[0] || null,
    [cuti, hariIni]
  );

  if (memuat) return <p className="text-muted">Memuat…</p>;

  // Akun tanpa data karyawan: Admin sistem, atau orang yang belum disambungkan.
  // Peran pengelola tetap mendapat kotak "Perlu tindakan"; kartu absen
  // tidak ditampilkan karena tidak ada catatan kehadiran yang bisa diisi.
  if (!employeeId)
    return (
      <>
        <div className="kartu">
          <p className="text-sm text-muted">{sapaan()},</p>
          <h2 className="text-xl font-bold text-ink">{profile?.name}</h2>
          <p className="mt-2 text-sm text-muted">
            Akun ini tidak tersambung ke data karyawan, jadi tidak ada absen untuk Anda.
            {punyaTindakan(profile?.role)
              ? " Kalau Anda juga karyawan yang wajib absen, sambungkan akun ini lewat Pengguna & Peran."
              : " Minta Admin membuka Pengguna & Peran, lalu memilih nama Anda."}
          </p>
        </div>
        <PerluTindakan hariIni={hariIni} />
      </>
    );

  if (!karyawan) return <Pesan jenis="gagal" isi="Data karyawan Anda tidak ditemukan." />;

  const jadwal = jadwalUntuk(karyawan, hariIni);
  // Mandor tidak absen di /absen: ia mencatat dirinya bersama timnya di lapangan.
  const mandor = profile?.role === "MANDOR" || karyawan.position === "MANDOR";

  return (
    <>
      {/* Sapaan */}
      <div className="kartu">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <FotoKaryawan nama={karyawan.name} url={karyawan.profilePhotoUrl} px={56} />
            <div>
              <p className="text-sm text-muted">{sapaan()},</p>
              <h2 className="text-xl font-bold text-ink">
                {karyawan.nickname || karyawan.name.split(" ")[0]}
              </h2>
              <p className="text-sm text-muted">
                {karyawan.employeeCode} · {karyawan.position}
                {karyawan.divisi ? ` · ${karyawan.divisi}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted">Jadwal hari ini</p>
            <p className="text-lg font-bold text-allegro-700">
              {jadwal.masuk}–{jadwal.pulang}
            </p>
          </div>
        </div>
      </div>

      {(salah || pesan) && (
        <div className="mt-4">
          {salah ? <Pesan jenis="gagal" isi={salah} /> : <Pesan jenis="berhasil" isi={pesan!} />}
        </div>
      )}

      {/* Absen hari ini */}
      <div className="kartu mt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <p className="text-[11px] text-muted">Masuk hari ini</p>
              <p className="text-xl font-bold leading-tight text-ink">
                {jamDari(absenHariIni?.masuk?.waktu)}
              </p>
              {absenHariIni && absenHariIni.terlambatMenit > 0 && (
                <p className="text-[11px] font-semibold text-bahaya">
                  telat {absenHariIni.terlambatMenit} menit
                </p>
              )}
            </div>
            {absenHariIni?.istirahat && (
              <div>
                <p className="text-[11px] text-muted">Istirahat</p>
                <p className="text-xl font-bold leading-tight text-ink">
                  {jamDari(absenHariIni.istirahat.waktu)}–
                  {absenHariIni.selesaiIstirahat ? jamDari(absenHariIni.selesaiIstirahat.waktu) : "…"}
                </p>
              </div>
            )}
            <div>
              <p className="text-[11px] text-muted">Pulang</p>
              <p className="text-xl font-bold leading-tight text-ink">
                {jamDari(absenHariIni?.pulang?.waktu)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted">Jam kerja</p>
              <p className="text-xl font-bold leading-tight text-ink">
                {absenHariIni?.workHours ?? 0}
              </p>
            </div>
          </div>

          {karyawan.tidakWajibAbsen ? (
            <div className="rounded-xl bg-allegro-50 px-5 py-3 text-sm text-allegro-700">Tidak wajib absen</div>
          ) : mandor ? (
            <Link href="/mandor" className="btn-lapangan max-w-[14rem]">
              Absen tim hari ini
            </Link>
          ) : cutiHariIni && !absenHariIni?.masuk ? (
            <div className="rounded-xl bg-allegro-50 px-5 py-3 text-sm text-allegro-700">
              Anda sedang {JENIS_CUTI[cutiHariIni.jenis]?.label.toLowerCase() || "cuti"} sampai{" "}
              {tanggalPendek(cutiHariIni.tanggalSelesai)}
            </div>
          ) : libur && !absenHariIni?.masuk ? (
            <div className="rounded-xl bg-allegro-50 px-5 py-3 text-sm text-allegro-700">
              Hari libur: {libur.nama}
            </div>
          ) : (
            <Link href="/absen" className="btn-lapangan max-w-[14rem]">
              {!absenHariIni?.masuk
                ? "Absen masuk"
                : absenHariIni?.pulang
                ? "Absen sudah lengkap"
                : absenHariIni?.istirahat && !absenHariIni?.selesaiIstirahat
                ? "Selesai istirahat"
                : !absenHariIni?.istirahat && !hariSabtu(hariIni)
                ? "Istirahat atau pulang"
                : "Absen pulang"}
            </Link>
          )}
        </div>
        {mandor && (
          <p className="mt-3 text-xs text-muted">
            Kehadiran Anda dicatat bersama tim di halaman mandor, jadi angka di atas tetap kosong.
          </p>
        )}
      </div>

      <PerluTindakan hariIni={hariIni} />

      {/* Angka penting */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Angka
          label="Sisa cuti tahunan"
          nilai={`${sisaTahunan(saldo)} hari`}
          keterangan={saldo ? `dari ${saldo.jatahTahunan + saldo.penyesuaian} hari` : "kartu cuti belum dibuat"}
        />
        <Angka label="Sisa jatah sakit" nilai={`${sisaSakit(saldo)} hari`} keterangan="berbayar, dengan surat dokter" />
        <Angka
          label="Hadir bulan ini"
          nilai={rekapBulan.hariHadir}
          keterangan={`${rekapBulan.jamKerja} jam kerja`}
        />
        <Angka
          label="Keterlambatan bulan ini"
          nilai={rekapBulan.kejadianTelat}
          keterangan={`${rekapBulan.menitTelat} menit seluruhnya`}
          warna={rekapBulan.kejadianTelat > 0 ? "text-bahaya" : "text-ink"}
        />
      </div>

      {/* Hal yang perlu diperhatikan */}
      {(spAktif.length > 0 || cutiMenunggu.length > 0 || cutiBerikut || rekapBulan.belumPulang > 0) && (
        <div className="kartu mt-4">
          <p className="mb-3 text-sm font-semibold text-ink">Perlu diperhatikan</p>
          <ul className="space-y-2 text-sm text-muted">
            {spAktif.map((x) => (
              <li key={x.id}>
                <span className="label-status bg-red-100 text-bahaya">SP {x.tingkat}</span>{" "}
                {x.kategoriNama} · berlaku sampai {tanggalPendek(x.berlakuSampai)}
              </li>
            ))}
            {cutiMenunggu.map((c) => (
              <li key={c.id}>
                <span className="label-status bg-kuning-400/40 text-allegro-700">Menunggu</span>{" "}
                {JENIS_CUTI[c.jenis]?.label || c.jenis} · {tanggalPendek(c.tanggalMulai)}
              </li>
            ))}
            {cutiBerikut && (
              <li>
                <span className="label-status bg-green-100 text-green-800">Disetujui</span>{" "}
                {JENIS_CUTI[cutiBerikut.jenis]?.label} mulai {tanggalPendek(cutiBerikut.tanggalMulai)}
              </li>
            )}
            {rekapBulan.belumPulang > 0 && (
              <li>
                <span className="label-status bg-red-100 text-bahaya">Belum lengkap</span>{" "}
                {rekapBulan.belumPulang} hari tidak ada absen pulang. Hubungi Admin untuk dikoreksi.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Menu */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={mandor ? "/mandor" : "/absen"} className="kartu hover:border-allegro-600">
          <h3 className="font-semibold text-ink">{mandor ? "Absen Tim" : "Absen Saya"}</h3>
          <p className="mt-1 text-sm text-muted">
            {mandor ? "Catat kehadiran tim dan diri sendiri." : "Absen masuk dan pulang."}
          </p>
        </Link>
        <Link href="/cuti" className="kartu hover:border-allegro-600">
          <h3 className="font-semibold text-ink">Cuti &amp; Izin</h3>
          <p className="mt-1 text-sm text-muted">Ajukan dan lihat saldo.</p>
        </Link>
        <Link href="/lembur" className="kartu hover:border-allegro-600">
          <h3 className="font-semibold text-ink">Lembur</h3>
          <p className="mt-1 text-sm text-muted">Ajukan pengakuan lembur.</p>
        </Link>
        <Link href="/sp" className="kartu hover:border-allegro-600">
          <h3 className="font-semibold text-ink">Surat Peringatan</h3>
          <p className="mt-1 text-sm text-muted">Catatan atas nama Anda.</p>
        </Link>
        <button
          className="kartu text-left hover:border-allegro-600"
          onClick={() => {
            setUNickname(karyawan.nickname || "");
            setUPhone(karyawan.phone || "");
            setUAddress(karyawan.address || "");
            setUBank(karyawan.bankName || "");
            setURekening(karyawan.bankAccountNumber || "");
            setUAtasNama(karyawan.bankAccountName || "");
            setSalah(null);
            setBuka(true);
          }}
        >
          <h3 className="font-semibold text-ink">Data Pribadi</h3>
          <p className="mt-1 text-sm text-muted">Foto, HP, alamat, dan rekening gaji.</p>
          {!karyawan.bankAccountNumber && (
            <p className="mt-1 text-xs font-semibold text-bahaya">Rekening belum diisi</p>
          )}
        </button>
      </div>

      {/* Tim saya — hanya muncul kalau punya bawahan */}
      {bawahan.length > 0 && (
        <>
          <h3 className="mt-6 text-lg font-bold text-allegro-700">
            Tim saya hari ini
            <span className="ml-2 text-sm font-normal text-muted">{bawahan.length} orang</span>
          </h3>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Angka
              label="Sudah absen masuk"
              nilai={bawahan.filter((b) => absenBawahan.some((a) => a.employeeId === b.id && a.masuk)).length}
              keterangan={`dari ${bawahan.length} orang`}
            />
            <Angka
              label="Telat hari ini"
              nilai={absenBawahan.filter((a) => a.terlambatMenit > 0).length}
              warna={
                absenBawahan.some((a) => a.terlambatMenit > 0) ? "text-bahaya" : "text-ink"
              }
            />
            <Angka
              label="Sedang cuti hari ini"
              nilai={
                cutiBawahan.filter(
                  (c) =>
                    c.status === "DISETUJUI" &&
                    c.tanggalMulai <= hariIni &&
                    c.tanggalSelesai >= hariIni
                ).length
              }
            />
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="tabel-padat">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Posisi</th>
                  <th>Masuk</th>
                  <th>Pulang</th>
                  <th className="text-right">Telat</th>
                  <th>Keadaan</th>
                </tr>
              </thead>
              <tbody>
                {bawahan.map((b) => {
                  const a = absenBawahan.find((x) => x.employeeId === b.id) || null;
                  const cutiHariIni = cutiBawahan.find(
                    (c) =>
                      c.employeeId === b.id &&
                      c.status === "DISETUJUI" &&
                      c.tanggalMulai <= hariIni &&
                      c.tanggalSelesai >= hariIni
                  );
                  return (
                    <tr key={b.id}>
                      <td className="max-w-[190px]">
                        <p className="truncate font-semibold text-ink">{b.name}</p>
                        <p className="text-[10px] text-muted">{b.employeeCode}</p>
                      </td>
                      <td className="text-muted">{b.position}</td>
                      <td className="whitespace-nowrap">{jamDari(a?.masuk?.waktu)}</td>
                      <td className="whitespace-nowrap">{jamDari(a?.pulang?.waktu)}</td>
                      <td className={`text-right ${a && a.terlambatMenit > 0 ? "text-bahaya" : ""}`}>
                        {a?.terlambatMenit || "—"}
                      </td>
                      <td>
                        {cutiHariIni ? (
                          <span className="label-status bg-allegro-100 text-allegro-700">
                            {JENIS_CUTI[cutiHariIni.jenis]?.label || cutiHariIni.jenis}
                          </span>
                        ) : a?.masuk ? (
                          <span className="label-status bg-green-100 text-green-800">
                            {a.pulang ? "Sudah pulang" : "Sedang bekerja"}
                          </span>
                        ) : (
                          <span className="label-status bg-surface text-muted">Belum absen</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {cutiBawahan.filter((c) => c.status === "DIAJUKAN").length > 0 && (
            <div className="kartu mt-3">
              <p className="text-sm font-semibold text-ink">
                Pengajuan cuti tim yang masih menunggu keputusan
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {cutiBawahan
                  .filter((c) => c.status === "DIAJUKAN")
                  .map((c) => (
                    <li key={c.id}>
                      {c.employeeName} · {JENIS_CUTI[c.jenis]?.label || c.jenis} ·{" "}
                      {tanggalPendek(c.tanggalMulai)}
                      {c.tanggalSelesai !== c.tanggalMulai && `–${tanggalPendek(c.tanggalSelesai)}`}
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                Keputusannya tetap di HR dan Owner. Bagian ini supaya atasan tahu anggotanya sedang
                mengajukan apa.
              </p>
            </div>
          )}

          <p className="mt-2 text-xs text-muted">
            Daftar ini berisi karyawan yang atasan langsungnya Anda. Kalau ada yang kurang atau
            berlebih, minta Admin membetulkan kolom Atasan langsung di data karyawan.
          </p>
        </>
      )}

      {/* Riwayat absen */}
      <h3 className="mt-6 text-lg font-bold text-allegro-700">Absensi saya bulan ini</h3>

      {absenKantor.length === 0 && absenLapangan.length === 0 ? (
        <div className="kartu mt-3 text-center">
          <p className="text-sm text-muted">Belum ada catatan absensi bulan ini.</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="tabel-padat">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Tempat</th>
                <th>Masuk</th>
                <th>Pulang</th>
                <th className="text-right">Jam</th>
                <th className="text-right">Telat</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {absenKantor.map((a) => {
                const e = jamEfektifKantor(a);
                return (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{tanggalPendek(a.date)}</td>
                    <td className="text-muted">{a.masuk?.kantorNama || "Kantor"}</td>
                    <td className="whitespace-nowrap">{e.masuk || "—"}</td>
                    <td className="whitespace-nowrap">
                      {e.pulang || <span className="text-bahaya">belum</span>}
                    </td>
                    <td className="text-right font-semibold text-ink">{a.workHours}</td>
                    <td className={`text-right ${a.terlambatMenit > 0 ? "text-bahaya" : ""}`}>
                      {a.terlambatMenit || "—"}
                    </td>
                    <td className="text-muted">
                      {a.masuk?.diLuarRadius || a.pulang?.diLuarRadius
                        ? `Luar kantor${a.hasilValidasi ? ` · ${a.hasilValidasi}` : " · menunggu diperiksa"}`
                        : a.isOverridden
                        ? "Dikoreksi Admin"
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {absenLapangan.map((a) => {
                const h = hitungJam(a);
                return (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{tanggalPendek(a.date)}</td>
                    <td className="text-muted">{a.projectId}</td>
                    <td className="whitespace-nowrap">{jamDari(a.checkIn?.waktu)}</td>
                    <td className="whitespace-nowrap">{jamDari(a.checkOut?.waktu)}</td>
                    <td className="text-right font-semibold text-ink">{h.workHours}</td>
                    <td className="text-right">—</td>
                    <td className="text-muted">Proyek · {h.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Data pribadi */}
      <Modal judul="Data pribadi" terbuka={buka} onTutup={() => setBuka(false)}>
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <div className="flex items-center gap-4">
            <FotoKaryawan nama={karyawan.name} url={karyawan.profilePhotoUrl} px={64} />
            <div>
              <input
                ref={berkas}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setSibuk(true);
                  try {
                    const hasil = await unggahFoto(file, FOLDER_PROFIL);
                    await ubahFotoSaya(employeeId, hasil.url, hasil.publicId);
                    await muatKaryawan();
                    setPesan("Foto profil diperbarui.");
                  } catch (err) {
                    setSalah(err instanceof Error ? err.message : "Foto gagal diunggah.");
                  } finally {
                    setSibuk(false);
                    if (berkas.current) berkas.current.value = "";
                  }
                }}
              />
              <button
                className="btn-ringan"
                disabled={sibuk || !cloudinarySiap()}
                onClick={() => berkas.current?.click()}
              >
                Ganti foto profil
              </button>
            </div>
          </div>

          <Field label="Nama panggilan">
            <input
              className="input-dasar"
              value={uNickname}
              onChange={(e) => setUNickname(e.target.value)}
            />
          </Field>

          <Field label="Nomor HP">
            <input
              className="input-dasar"
              inputMode="tel"
              value={uPhone}
              onChange={(e) => setUPhone(e.target.value)}
            />
          </Field>

          <Field label="Alamat">
            <textarea
              className="input-dasar"
              rows={3}
              value={uAddress}
              onChange={(e) => setUAddress(e.target.value)}
            />
          </Field>

          <div className="rounded-lg border border-line p-4">
            <p className="mb-1 text-sm font-medium text-ink">Rekening penerima gaji</p>
            <p className="mb-3 text-xs text-muted">
              Isi sesuai buku tabungan. Gaji ditransfer ke rekening ini, jadi periksa angkanya dua kali. Setiap
              perubahan tercatat waktunya dan terlihat oleh HR.
            </p>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama bank">
                  <input className="input-dasar" value={uBank} onChange={(e) => setUBank(e.target.value)} placeholder="BCA" />
                </Field>
                <Field label="Nomor rekening">
                  <input
                    className="input-dasar"
                    inputMode="numeric"
                    value={uRekening}
                    onChange={(e) => setURekening(e.target.value.replace(/[^\d-]/g, ""))}
                  />
                </Field>
              </div>
              <Field label="Atas nama" bantuan="Nama pemilik rekening persis seperti di buku tabungan.">
                <input className="input-dasar" value={uAtasNama} onChange={(e) => setUAtasNama(e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="rounded-lg bg-surface p-3 text-xs text-muted">
            <p className="font-semibold text-ink">Yang hanya bisa diubah Admin</p>
            <p className="mt-1">
              Nama lengkap, NIK, jabatan, divisi, jadwal kerja, dan tarif. Kalau ada yang keliru, hubungi HR.
            </p>
          </div>

          <button
            className="btn-utama w-full"
            disabled={sibuk}
            onClick={async () => {
              setSalah(null);
              setSibuk(true);
              try {
                await ubahDataPribadi(
                  employeeId,
                  {
                    nickname: uNickname,
                    phone: uPhone,
                    address: uAddress,
                    bankName: uBank,
                    bankAccountNumber: uRekening,
                    bankAccountName: uAtasNama,
                  },
                  karyawan
                );
                await muatKaryawan();
                setBuka(false);
                setPesan("Data pribadi diperbarui.");
              } catch (e) {
                setSalah(e instanceof Error ? e.message : "Data gagal disimpan.");
              } finally {
                setSibuk(false);
              }
            }}
          >
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default function BerandaKaryawan() {
  return (
    <Guard izinkan={["ADMIN", "FINANCE", "MANDOR", "HR", "OWNER", "KARYAWAN"]}>
      <Shell judul="Beranda" keterangan="Ringkasan kehadiran, cuti, dan data Anda." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
