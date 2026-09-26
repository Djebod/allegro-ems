"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import FotoKaryawan from "@/components/FotoKaryawan";
import { Field, Pesan } from "@/components/Field";
import { buatKaryawan, pantauKaryawan, rapikanKode, ubahKaryawan } from "@/lib/data";
import type { Employee, EmployeeStatus, Position } from "@/types";

const POSISI: Position[] = ["MANDOR", "TUKANG", "KENEK"];

const kosong = {
  employeeCode: "",
  nik: "",
  name: "",
  nickname: "",
  position: "TUKANG" as Position,
  divisi: "",
  phone: "",
  address: "",
  joinDate: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountName: "",
};

function Isi() {
  const [karyawan, setKaryawan] = useState<Employee[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagalBaca, setGagalBaca] = useState(false);

  const [cari, setCari] = useState("");
  const [filterPosisi, setFilterPosisi] = useState<"SEMUA" | Position>("SEMUA");

  const [buka, setBuka] = useState(false);
  const [form, setForm] = useState(kosong);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    return pantauKaryawan(
      (d) => {
        setKaryawan(d);
        setMemuat(false);
      },
      () => {
        setGagalBaca(true);
        setMemuat(false);
      }
    );
  }, []);

  const terlihat = useMemo(() => {
    const k = cari.trim().toLowerCase();
    return karyawan.filter((e) => {
      const cocokPosisi = filterPosisi === "SEMUA" || e.position === filterPosisi;
      const cocokCari =
        !k ||
        e.name.toLowerCase().includes(k) ||
        e.employeeCode.toLowerCase().includes(k) ||
        e.nik.includes(k);
      return cocokPosisi && cocokCari;
    });
  }, [karyawan, cari, filterPosisi]);

  function isi(k: keyof typeof kosong, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function simpan() {
    setSalah(null);

    if (!rapikanKode(form.employeeCode)) return setSalah("Kode karyawan wajib diisi.");
    if (!form.name.trim()) return setSalah("Nama wajib diisi.");
    if (!/^\d{16}$/.test(form.nik.trim())) return setSalah("NIK harus 16 angka.");

    setMenyimpan(true);
    try {
      await buatKaryawan({
        employeeCode: form.employeeCode,
        nik: form.nik.trim(),
        name: form.name.trim(),
        nickname: form.nickname.trim(),
        position: form.position,
        divisi: form.divisi.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        joinDate: form.joinDate,
        status: "ACTIVE",
        bankName: form.bankName.trim(),
        bankAccountNumber: form.bankAccountNumber.trim(),
        bankAccountName: form.bankAccountName.trim(),
        profilePhotoUrl: null,
        profilePublicId: null,
        currentProjectId: null,
        currentSectionId: null,
        currentMandorId: null,
      });
      setForm(kosong);
      setBuka(false);
      setPesan("Karyawan tersimpan.");
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Data gagal disimpan.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function gantiStatus(e: Employee) {
    const baru: EmployeeStatus = e.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await ubahKaryawan(e.id, { status: baru });
      setPesan(`${e.name} sekarang ${baru === "ACTIVE" ? "aktif" : "nonaktif"}.`);
    } catch {
      setPesan("Status gagal diubah.");
    }
  }

  if (memuat) return <p className="text-muted">Memuat data karyawan…</p>;

  if (gagalBaca)
    return (
      <Pesan
        jenis="gagal"
        isi="Data karyawan tidak bisa dibaca. Pastikan firestore.rules versi terbaru sudah di-publish di Firebase Console."
      />
    );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button className="btn-utama" onClick={() => setBuka(true)}>
          Tambah karyawan
        </button>
        <input
          className="input-dasar max-w-xs"
          placeholder="Cari nama, kode, atau NIK"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <select
          className="input-dasar max-w-[9rem]"
          value={filterPosisi}
          onChange={(e) => setFilterPosisi(e.target.value as "SEMUA" | Position)}
        >
          <option value="SEMUA">Semua posisi</option>
          {POSISI.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {pesan && (
        <div className="mb-4">
          <Pesan jenis="berhasil" isi={pesan} />
        </div>
      )}

      {terlihat.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">
            {karyawan.length === 0
              ? "Belum ada karyawan. Tambahkan mandor lebih dulu, karena merekalah yang mencatat absensi tim."
              : "Tidak ada yang cocok dengan pencarian ini."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {terlihat.map((e) => (
            <div key={e.id} className="kartu">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FotoKaryawan nama={e.name} url={e.profilePhotoUrl} px={48} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted">
                      {e.employeeCode} · {e.position}
                    </p>
                    <p className="font-semibold text-ink">
                      {e.name}
                      {e.nickname ? ` (${e.nickname})` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      NIK {e.nik}
                      {e.phone ? ` · ${e.phone}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`label-status ${
                      e.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-surface text-muted"
                    }`}
                  >
                    {e.status}
                  </span>
                  <button className="btn-ringan" onClick={() => gantiStatus(e)}>
                    {e.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <Link className="btn-ringan" href={`/admin/karyawan/${e.id}`}>
                    Buka
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal judul="Karyawan baru" terbuka={buka} onTutup={() => setBuka(false)}>
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kode karyawan" wajib bantuan="Tidak bisa diubah. Contoh: TKG-001">
              <input
                className="input-dasar"
                value={form.employeeCode}
                onChange={(e) => isi("employeeCode", e.target.value)}
              />
            </Field>
            <Field label="Posisi" wajib>
              <select
                className="input-dasar"
                value={form.position}
                onChange={(e) => isi("position", e.target.value)}
              >
                {POSISI.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Nama lengkap" wajib>
            <input className="input-dasar" value={form.name} onChange={(e) => isi("name", e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama panggilan">
              <input
                className="input-dasar"
                value={form.nickname}
                onChange={(e) => isi("nickname", e.target.value)}
              />
            </Field>
            <Field
              label="Divisi"
              bantuan="Dipakai untuk aturan satu divisi hanya satu orang cuti bersamaan."
            >
              <input
                className="input-dasar"
                value={form.divisi}
                onChange={(e) => isi("divisi", e.target.value)}
                placeholder="Admin Proyek"
              />
            </Field>
            <Field label="Nomor HP">
              <input
                className="input-dasar"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => isi("phone", e.target.value)}
              />
            </Field>
          </div>

          <Field label="NIK" wajib bantuan="16 angka sesuai KTP.">
            <input
              className="input-dasar"
              inputMode="numeric"
              maxLength={16}
              value={form.nik}
              onChange={(e) => isi("nik", e.target.value.replace(/\D/g, ""))}
            />
          </Field>

          <Field label="Alamat">
            <textarea
              className="input-dasar"
              rows={2}
              value={form.address}
              onChange={(e) => isi("address", e.target.value)}
            />
          </Field>

          <Field label="Tanggal masuk">
            <input
              type="date"
              className="input-dasar"
              value={form.joinDate}
              onChange={(e) => isi("joinDate", e.target.value)}
            />
          </Field>

          <div className="rounded-lg border border-line p-4">
            <p className="mb-3 text-sm font-medium text-ink">Rekening (opsional)</p>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama bank">
                  <input
                    className="input-dasar"
                    value={form.bankName}
                    onChange={(e) => isi("bankName", e.target.value)}
                  />
                </Field>
                <Field label="Nomor rekening">
                  <input
                    className="input-dasar"
                    inputMode="numeric"
                    value={form.bankAccountNumber}
                    onChange={(e) => isi("bankAccountNumber", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Atas nama">
                <input
                  className="input-dasar"
                  value={form.bankAccountName}
                  onChange={(e) => isi("bankAccountName", e.target.value)}
                />
              </Field>
            </div>
          </div>

          <p className="text-xs text-muted">
            Foto, tarif gaji, dan penugasan diisi di halaman detail setelah karyawan tersimpan.
          </p>

          <button className="btn-utama w-full" onClick={simpan} disabled={menyimpan}>
            {menyimpan ? "Menyimpan…" : "Simpan karyawan"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default function HalamanKaryawan() {
  return (
    <Guard izinkan={["ADMIN"]}>
      <Shell judul="Data Karyawan" keterangan="Mandor, tukang, dan kenek yang bekerja di proyek.">
        <Isi />
      </Shell>
    </Guard>
  );
}
