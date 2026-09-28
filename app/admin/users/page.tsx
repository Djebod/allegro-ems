"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { dbClient, SUPER_ADMIN_EMAIL } from "@/lib/firebase";
import type { AppUser, RoleOrPending, UserStatus } from "@/types";

const PERAN: RoleOrPending[] = ["PENDING", "ADMIN", "HR", "OWNER", "FINANCE", "MANDOR", "KARYAWAN"];

const NAMA_PERAN: Record<RoleOrPending, string> = {
  PENDING: "Belum diberi peran",
  ADMIN: "Admin",
  HR: "HR",
  OWNER: "Owner",
  FINANCE: "Finance",
  MANDOR: "Mandor",
  KARYAWAN: "Karyawan",
};

const NAMA_STATUS: Record<UserStatus, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  PENDING: "Menunggu",
};

function warnaStatus(status: UserStatus) {
  if (status === "ACTIVE") return "bg-green-100 text-green-800";
  if (status === "INACTIVE") return "bg-red-100 text-bahaya";
  return "bg-kuning-400/40 text-allegro-700";
}

type Urutan = "nama" | "peran" | "status";
type SaringSambung = "SEMUA" | "SUDAH" | "BELUM";

interface Undangan {
  email: string;
  role: RoleOrPending;
  employeeId: string | null;
  employeeName: string;
  dibuatOleh: string;
  createdAt?: { toDate?: () => Date };
}

interface KaryawanRingkas {
  id: string;
  name: string;
}

function DaftarPengguna() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [karyawan, setKaryawan] = useState<KaryawanRingkas[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState<{ isi: string; jenis: "gagal" | "berhasil" } | null>(null);
  const [menyimpan, setMenyimpan] = useState<string | null>(null);

  const [cari, setCari] = useState("");
  const [saringPeran, setSaringPeran] = useState<RoleOrPending | "SEMUA">("SEMUA");
  const [saringStatus, setSaringStatus] = useState<UserStatus | "SEMUA">("SEMUA");
  const [saringSambung, setSaringSambung] = useState<SaringSambung>("SEMUA");
  const [urutan, setUrutan] = useState<Urutan>("nama");
  const [naik, setNaik] = useState(true);
  const [undangan, setUndangan] = useState<Undangan[]>([]);

  // Formulir undang pengguna
  const [bukaUndang, setBukaUndang] = useState(false);
  const [uEmail, setUEmail] = useState("");
  const [uPeran, setUPeran] = useState<RoleOrPending>("KARYAWAN");
  const [uKaryawan, setUKaryawan] = useState("");
  const [uSalah, setUSalah] = useState<string | null>(null);
  const [uSibuk, setUSibuk] = useState(false);

  useEffect(() => {
    // Seluruh karyawan aktif, untuk menyambungkan akun login dengan data
    // karyawannya. Sambungan ini yang dipakai saldo cuti dan absensi.
    const lepasKaryawan = onSnapshot(
      query(collection(dbClient(), "employees"), where("status", "==", "ACTIVE")),
      (snap) =>
        setKaryawan(
          snap.docs
            .map((d) => ({ id: d.id, name: String(d.data().name || d.id) }))
            .sort((a, b) => a.name.localeCompare(b.name, "id"))
        ),
      () => setKaryawan([])
    );

    const lepasUsers = onSnapshot(
      collection(dbClient(), "users"),
      (snap) => {
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<AppUser, "uid">) })));
        setMemuat(false);
      },
      () => {
        setPesan({ isi: "Data pengguna tidak bisa dibaca. Periksa Security Rules.", jenis: "gagal" });
        setMemuat(false);
      }
    );

    const lepasUndangan = onSnapshot(
      collection(dbClient(), "undangan"),
      (snap) =>
        setUndangan(
          snap.docs
            .map((d) => d.data() as Undangan)
            .sort((a, b) => a.email.localeCompare(b.email))
        ),
      () => setUndangan([])
    );

    return () => {
      lepasKaryawan();
      lepasUsers();
      lepasUndangan();
    };
  }, []);

  const namaKaryawan = useMemo(() => new Map(karyawan.map((k) => [k.id, k.name])), [karyawan]);

  /**
   * Karyawan yang sudah dipakai akun lain. Satu karyawan dengan dua akun
   * berarti absen dan cutinya bisa diisi dua orang - jadi pilihan itu
   * dikunci di daftar, bukan hanya diperingatkan.
   */
  const dipakaiOleh = useMemo(() => {
    const peta = new Map<string, Pick<AppUser, "uid" | "name">>();
    users.forEach((u) => u.employeeId && peta.set(u.employeeId, u));
    // Karyawan yang sudah disiapkan untuk undangan juga terkunci.
    undangan.forEach(
      (x) => x.employeeId && !peta.has(x.employeeId) && peta.set(x.employeeId, { uid: `undangan:${x.email}`, name: `undangan ${x.email}` })
    );
    return peta;
  }, [users, undangan]);

  function bukaFormUndang() {
    setUEmail("");
    setUPeran("KARYAWAN");
    setUKaryawan("");
    setUSalah(null);
    setBukaUndang(true);
  }

  async function simpanUndangan() {
    const email = uEmail.trim().toLowerCase();
    setUSalah(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setUSalah("Alamat email belum benar.");
    if (email === SUPER_ADMIN_EMAIL) return setUSalah("Email super admin tidak perlu diundang.");
    if (users.some((u) => u.email?.toLowerCase() === email)) {
      return setUSalah("Email ini sudah punya akun. Atur peran dan sambungannya langsung di tabel di bawah.");
    }
    if (undangan.some((x) => x.email === email)) return setUSalah("Email ini sudah diundang.");
    if (uPeran === "PENDING") return setUSalah("Pilih perannya.");
    if (uKaryawan && dipakaiOleh.has(uKaryawan)) {
      return setUSalah(`Karyawan ini sudah dipakai ${dipakaiOleh.get(uKaryawan)!.name}.`);
    }
    if (uPeran === "ADMIN" && !window.confirm(`Undang ${email} sebagai Admin? Admin bisa membuka seluruh data.`)) return;

    setUSibuk(true);
    try {
      const ref = doc(dbClient(), "undangan", email);
      if ((await getDoc(ref)).exists()) throw new Error("Email ini sudah diundang.");
      await setDoc(ref, {
        email,
        role: uPeran,
        employeeId: uKaryawan || null,
        employeeName: uKaryawan ? namaKaryawan.get(uKaryawan) || uKaryawan : "",
        dibuatOleh: profile?.name || "",
        createdAt: serverTimestamp(),
      });
      setBukaUndang(false);
      setPesan({
        isi: `Undangan untuk ${email} tersimpan. Begitu ia login Google dengan email itu, akunnya langsung aktif.`,
        jenis: "berhasil",
      });
    } catch (e) {
      setUSalah(e instanceof Error && e.message.includes("diundang") ? e.message : "Undangan gagal disimpan. Periksa Security Rules.");
    } finally {
      setUSibuk(false);
    }
  }

  async function batalkanUndangan(x: Undangan) {
    if (!window.confirm(`Batalkan undangan untuk ${x.email}?`)) return;
    try {
      await deleteDoc(doc(dbClient(), "undangan", x.email));
      setPesan({ isi: `Undangan untuk ${x.email} dibatalkan.`, jenis: "berhasil" });
    } catch {
      setPesan({ isi: "Undangan gagal dibatalkan.", jenis: "gagal" });
    }
  }

  const ringkasan = useMemo(
    () => ({
      semua: users.length,
      menunggu: users.filter((u) => u.role === "PENDING").length,
      belumSambung: users.filter((u) => u.role !== "PENDING" && !u.employeeId).length,
      nonaktif: users.filter((u) => u.status === "INACTIVE").length,
    }),
    [users]
  );

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    const hasil = users.filter((u) => {
      if (saringPeran !== "SEMUA" && u.role !== saringPeran) return false;
      if (saringStatus !== "SEMUA" && u.status !== saringStatus) return false;
      if (saringSambung === "SUDAH" && !u.employeeId) return false;
      if (saringSambung === "BELUM" && (u.employeeId || u.role === "PENDING")) return false;
      if (!kata) return true;
      const teks = [u.name, u.email, u.employeeId || "", namaKaryawan.get(u.employeeId || "") || ""]
        .join(" ")
        .toLowerCase();
      return teks.includes(kata);
    });

    const arah = naik ? 1 : -1;
    const banding = (a: AppUser, b: AppUser) => {
      const nama = (a.name || "").localeCompare(b.name || "", "id");
      if (urutan === "peran") return (PERAN.indexOf(a.role) - PERAN.indexOf(b.role)) * arah || nama;
      if (urutan === "status") return a.status.localeCompare(b.status) * arah || nama;
      return nama * arah;
    };
    return hasil.sort(banding);
  }, [users, cari, saringPeran, saringStatus, saringSambung, urutan, naik, namaKaryawan]);

  const adaSaringan =
    cari || saringPeran !== "SEMUA" || saringStatus !== "SEMUA" || saringSambung !== "SEMUA";

  function bersihkan() {
    setCari("");
    setSaringPeran("SEMUA");
    setSaringStatus("SEMUA");
    setSaringSambung("SEMUA");
  }

  function aturUrutan(u: Urutan) {
    if (urutan === u) setNaik(!naik);
    else {
      setUrutan(u);
      setNaik(true);
    }
  }

  async function ubah(u: AppUser, data: Partial<AppUser>, berhasil: string) {
    setPesan(null);
    setMenyimpan(u.uid);
    try {
      await updateDoc(doc(dbClient(), "users", u.uid), { ...data, updatedAt: serverTimestamp() });
      setPesan({ isi: berhasil, jenis: "berhasil" });
    } catch {
      setPesan({ isi: "Perubahan gagal disimpan. Periksa koneksi dan Security Rules.", jenis: "gagal" });
    } finally {
      setMenyimpan(null);
    }
  }

  function gantiPeran(u: AppUser, peran: RoleOrPending) {
    // Peran Admin membuka seluruh data gaji dan kepegawaian. Satu salah
    // klik di dropdown tidak boleh cukup untuk memberikannya.
    if (peran === "ADMIN" && !window.confirm(`Jadikan ${u.name} sebagai Admin? Admin bisa membuka seluruh data.`))
      return;
    ubah(
      u,
      { role: peran, status: peran === "PENDING" ? "PENDING" : "ACTIVE" },
      `Peran ${u.name} diubah menjadi ${NAMA_PERAN[peran]}.`
    );
  }

  function gantiStatus(u: AppUser) {
    const jadi: UserStatus = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (jadi === "INACTIVE" && !window.confirm(`Nonaktifkan ${u.name}? Ia tidak akan bisa masuk lagi.`)) return;
    ubah(u, { status: jadi }, `${u.name} ${jadi === "ACTIVE" ? "diaktifkan" : "dinonaktifkan"}.`);
  }

  function Kepala({ label, kolom }: { label: string; kolom: Urutan }) {
    const aktif = urutan === kolom;
    return (
      <th>
        <button className="inline-flex items-center gap-1 font-semibold" onClick={() => aturUrutan(kolom)}>
          {label}
          <span className={aktif ? "text-kuning-400" : "text-allegro-100/50"}>
            {aktif ? (naik ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    );
  }

  if (memuat) return <p className="text-muted">Memuat daftar pengguna…</p>;

  const Pintasan = ({
    label,
    nilai,
    aktif,
    onKlik,
    sorot,
  }: {
    label: string;
    nilai: number;
    aktif: boolean;
    onKlik: () => void;
    sorot?: boolean;
  }) => (
    <button
      onClick={onKlik}
      className={`kartu !p-4 text-left transition-colors ${
        aktif ? "!border-allegro-600 ring-1 ring-allegro-600" : "hover:border-allegro-600"
      }`}
    >
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${sorot && nilai > 0 ? "text-bahaya" : "text-ink"}`}>
        {nilai}
      </p>
    </button>
  );

  return (
    <>
      {/* Undangan */}
      <div className="kartu mb-4 !p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">Undang pengguna</p>
            <p className="text-xs text-muted">
              Siapkan akun sebelum orangnya login: email Gmail, peran, dan karyawan yang disambungkan. Begitu ia
              login, akunnya langsung aktif tanpa menunggu persetujuan.
            </p>
          </div>
          <button className="btn-utama" onClick={bukaFormUndang}>
            + Undang pengguna
          </button>
        </div>

        {undangan.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-line">
            <table className="tabel-padat min-w-[640px]">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Karyawan</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {undangan.map((x) => (
                  <tr key={x.email}>
                    <td className="font-semibold text-ink">{x.email}</td>
                    <td>{NAMA_PERAN[x.role] || x.role}</td>
                    <td>{x.employeeId ? `${x.employeeName || x.employeeId} (${x.employeeId})` : <span className="text-bahaya">belum dipilih</span>}</td>
                    <td>
                      <span className="label-status bg-kuning-400/40 text-allegro-700">Belum login</span>
                    </td>
                    <td className="text-right">
                      <button className="btn-ringan !px-2 !py-1 !text-xs text-bahaya" onClick={() => batalkanUndangan(x)}>
                        Batalkan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal judul="Undang pengguna" terbuka={bukaUndang} onTutup={() => setBukaUndang(false)}>
        <div className="space-y-4">
          <Field label="Email Gmail" wajib bantuan="Harus persis email yang nanti dipakai login Google.">
            <input
              className="input-dasar"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              value={uEmail}
              onChange={(e) => setUEmail(e.target.value)}
              placeholder="nama@gmail.com"
            />
          </Field>
          <Field label="Peran" wajib>
            <select className="input-dasar" value={uPeran} onChange={(e) => setUPeran(e.target.value as RoleOrPending)}>
              {PERAN.filter((x) => x !== "PENDING").map((x) => (
                <option key={x} value={x}>
                  {NAMA_PERAN[x]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sambungkan ke karyawan" bantuan="Wajib untuk yang absen, cuti, atau menerima slip gaji.">
            <select className="input-dasar" value={uKaryawan} onChange={(e) => setUKaryawan(e.target.value)}>
              <option value="">— belum dipilih —</option>
              {karyawan.map((k) => {
                const pemilik = dipakaiOleh.get(k.id);
                return (
                  <option key={k.id} value={k.id} disabled={!!pemilik}>
                    {k.name} ({k.id}){pemilik ? ` — dipakai ${pemilik.name}` : ""}
                  </option>
                );
              })}
            </select>
          </Field>
          {uSalah && <Pesan jenis="gagal" isi={uSalah} />}
          <button className="btn-utama w-full" onClick={simpanUndangan} disabled={uSibuk}>
            {uSibuk ? "Menyimpan…" : "Simpan undangan"}
          </button>
        </div>
      </Modal>

      {/* Pintasan saringan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Pintasan label="Semua pengguna" nilai={ringkasan.semua} aktif={!adaSaringan} onKlik={bersihkan} />
        <Pintasan
          label="Menunggu peran"
          nilai={ringkasan.menunggu}
          sorot
          aktif={saringPeran === "PENDING"}
          onKlik={() => {
            bersihkan();
            setSaringPeran("PENDING");
          }}
        />
        <Pintasan
          label="Belum tersambung ke karyawan"
          nilai={ringkasan.belumSambung}
          sorot
          aktif={saringSambung === "BELUM"}
          onKlik={() => {
            bersihkan();
            setSaringSambung("BELUM");
          }}
        />
        <Pintasan
          label="Nonaktif"
          nilai={ringkasan.nonaktif}
          aktif={saringStatus === "INACTIVE"}
          onKlik={() => {
            bersihkan();
            setSaringStatus("INACTIVE");
          }}
        />
      </div>

      {/* Cari dan saring */}
      <div className="kartu mt-4 !p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
          <input
            className="input-dasar"
            placeholder="Cari nama, email, atau kode karyawan"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            aria-label="Cari pengguna"
          />
          <select
            className="input-dasar"
            value={saringPeran}
            onChange={(e) => setSaringPeran(e.target.value as RoleOrPending | "SEMUA")}
            aria-label="Saring peran"
          >
            <option value="SEMUA">Semua peran</option>
            {PERAN.map((p) => (
              <option key={p} value={p}>
                {NAMA_PERAN[p]}
              </option>
            ))}
          </select>
          <select
            className="input-dasar"
            value={saringStatus}
            onChange={(e) => setSaringStatus(e.target.value as UserStatus | "SEMUA")}
            aria-label="Saring status"
          >
            <option value="SEMUA">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
            <option value="PENDING">Menunggu</option>
          </select>
          <select
            className="input-dasar"
            value={saringSambung}
            onChange={(e) => setSaringSambung(e.target.value as SaringSambung)}
            aria-label="Saring sambungan karyawan"
          >
            <option value="SEMUA">Semua sambungan</option>
            <option value="SUDAH">Sudah tersambung</option>
            <option value="BELUM">Belum tersambung</option>
          </select>
          <button className="btn-ringan" onClick={bersihkan} disabled={!adaSaringan}>
            Bersihkan
          </button>
        </div>
      </div>

      {pesan && (
        <div className="mt-4">
          <Pesan jenis={pesan.jenis} isi={pesan.isi} />
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        Menampilkan {tampil.length} dari {users.length} pengguna
      </p>

      <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="tabel-padat min-w-[860px]">
          <thead>
            <tr>
              <th className="w-10">No</th>
              <Kepala label="Nama" kolom="nama" />
              <Kepala label="Peran" kolom="peran" />
              <Kepala label="Status" kolom="status" />
              <th>Karyawan tersambung</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {tampil.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  Tidak ada pengguna yang cocok.{" "}
                  <button className="font-semibold text-allegro-600 hover:underline" onClick={bersihkan}>
                    Bersihkan saringan
                  </button>
                </td>
              </tr>
            )}
            {tampil.map((u, i) => {
              const superAdmin = u.email === SUPER_ADMIN_EMAIL;
              const diriSendiri = u.uid === profile?.uid;
              const sibuk = menyimpan === u.uid;
              const tersambung = u.employeeId ? namaKaryawan.get(u.employeeId) : null;
              return (
                <tr key={u.uid} className={sibuk ? "opacity-60" : ""}>
                  <td className="text-muted">{i + 1}</td>
                  <td className="max-w-[240px]">
                    <p className="truncate font-semibold text-ink">
                      {u.name}
                      {diriSendiri && <span className="ml-1 font-normal text-muted">(Anda)</span>}
                    </p>
                    <p className="truncate text-[11px] text-muted">{u.email}</p>
                  </td>
                  <td>
                    <select
                      className="input-dasar !py-1 !text-xs"
                      value={u.role}
                      disabled={superAdmin || sibuk}
                      onChange={(e) => gantiPeran(u, e.target.value as RoleOrPending)}
                      aria-label={`Peran ${u.name}`}
                    >
                      {PERAN.map((p) => (
                        <option key={p} value={p}>
                          {NAMA_PERAN[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`label-status ${warnaStatus(u.status)}`}>{NAMA_STATUS[u.status]}</span>
                  </td>
                  <td className="min-w-[220px]">
                    {u.role === "PENDING" ? (
                      <span className="text-[11px] text-muted">Beri peran dulu</span>
                    ) : (
                      <>
                        <select
                          className={`input-dasar !py-1 !text-xs ${u.employeeId ? "" : "!border-kuning-500"}`}
                          value={u.employeeId || ""}
                          disabled={sibuk}
                          onChange={(e) => {
                            const id = e.target.value || null;
                            ubah(
                              u,
                              { employeeId: id },
                              id
                                ? `${u.name} disambungkan ke ${namaKaryawan.get(id) || id}.`
                                : `Sambungan ${u.name} dilepas.`
                            );
                          }}
                          aria-label={`Karyawan untuk ${u.name}`}
                        >
                          <option value="">— belum dipilih —</option>
                          {/* Karyawan yang sudah nonaktif tetap ditampilkan kalau masih tersambung */}
                          {u.employeeId && !tersambung && (
                            <option value={u.employeeId}>{u.employeeId} (tidak aktif)</option>
                          )}
                          {karyawan.map((k) => {
                            const pemilik = dipakaiOleh.get(k.id);
                            const milikLain = pemilik && pemilik.uid !== u.uid;
                            return (
                              <option key={k.id} value={k.id} disabled={!!milikLain}>
                                {k.name} ({k.id}){milikLain ? ` — dipakai ${pemilik!.name}` : ""}
                              </option>
                            );
                          })}
                        </select>
                        {!u.employeeId && (
                          <p className="mt-0.5 text-[10px] text-bahaya">Tanpa ini tidak bisa absen dan cuti</p>
                        )}
                      </>
                    )}
                  </td>
                  <td className="text-right">
                    {superAdmin ? (
                      <span className="text-[11px] text-muted">Super admin</span>
                    ) : u.role === "PENDING" ? (
                      <span className="text-[11px] text-muted">—</span>
                    ) : (
                      <button
                        className="btn-ringan !px-2 !py-1 !text-xs"
                        disabled={sibuk || diriSendiri}
                        onClick={() => gantiStatus(u)}
                        title={diriSendiri ? "Tidak bisa menonaktifkan akun sendiri" : undefined}
                      >
                        {u.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        Satu karyawan hanya bisa tersambung ke satu akun (termasuk yang masih berupa undangan). Karyawan yang
        sudah dipakai tampil tetapi tidak bisa dipilih. Orang yang tidak diundang tetap bisa login, lalu masuk
        daftar &quot;Menunggu peran&quot;.
      </p>
    </>
  );
}

export default function HalamanPengguna() {
  return (
    <Guard izinkan={["ADMIN"]}>
      <Shell
        judul="Pengguna & Peran"
        keterangan="Beri peran, sambungkan ke data karyawan, dan kelola akses login."
        lebar
      >
        <DaftarPengguna />
      </Shell>
    </Guard>
  );
}
