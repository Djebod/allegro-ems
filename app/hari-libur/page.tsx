"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { hapusHariLibur, pantauHariLibur, tambahHariLibur } from "@/lib/data-cuti";
import { tanggalPendek } from "@/lib/absensi";
import type { HariLibur, JenisLibur } from "@/types";

const JENIS: { nilai: JenisLibur; label: string }[] = [
  { nilai: "NASIONAL", label: "Libur nasional" },
  { nilai: "CUTI_BERSAMA", label: "Cuti bersama" },
  { nilai: "PERUSAHAAN", label: "Libur perusahaan" },
];

function Isi() {
  const { profile } = useAuth();
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [libur, setLibur] = useState<HariLibur[]>([]);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const [tanggal, setTanggal] = useState("");
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState<JenisLibur>("NASIONAL");

  useEffect(() => {
    return pantauHariLibur(tahun, setLibur, () =>
      setSalah("Data hari libur tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.")
    );
  }, [tahun]);

  async function simpan() {
    setSalah(null);
    if (!tanggal) return setSalah("Tanggal wajib diisi.");
    if (!nama.trim()) return setSalah("Nama hari libur wajib diisi.");
    setSibuk(true);
    try {
      await tambahHariLibur({ tanggal, nama: nama.trim(), jenis, oleh: profile?.email || "" });
      setTanggal("");
      setNama("");
      setPesan("Hari libur ditambahkan.");
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="kartu mb-4">
        <p className="mb-3 text-sm font-semibold text-ink">Tambah hari libur</p>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Tanggal" wajib>
            <input
              type="date"
              className="input-dasar"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
            />
          </Field>
          <Field label="Nama" wajib>
            <input
              className="input-dasar"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Hari Kemerdekaan"
            />
          </Field>
          <Field label="Jenis" wajib>
            <select
              className="input-dasar"
              value={jenis}
              onChange={(e) => setJenis(e.target.value as JenisLibur)}
            >
              {JENIS.map((j) => (
                <option key={j.nilai} value={j.nilai}>
                  {j.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button className="btn-utama w-full" onClick={simpan} disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Tambah"}
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted">
          Hari Minggu tidak perlu dimasukkan — sistem sudah menganggapnya libur. Yang didaftarkan di
          sini akan dilewati saat menghitung jumlah hari cuti.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">Tahun</label>
        <select
          className="input-dasar max-w-[8rem]"
          value={tahun}
          onChange={(e) => setTahun(Number(e.target.value))}
        >
          {[tahun - 1, tahun, tahun + 1].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Link href="/cuti/kelola" className="btn-ringan ml-auto">
          Kelola cuti
        </Link>
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

      {libur.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">Belum ada hari libur terdaftar untuk {tahun}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tabel-padat">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Nama</th>
                <th>Jenis</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {libur.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{tanggalPendek(l.tanggal)}</td>
                  <td>{l.nama}</td>
                  <td>
                    <span
                      className={`label-status ${
                        l.jenis === "CUTI_BERSAMA"
                          ? "bg-kuning-400/40 text-allegro-700"
                          : "bg-allegro-100 text-allegro-700"
                      }`}
                    >
                      {JENIS.find((j) => j.nilai === l.jenis)?.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button
                      className="btn-ringan px-2 py-1 text-[11px]"
                      onClick={async () => {
                        if (!window.confirm(`Hapus ${l.nama} (${l.tanggal})?`)) return;
                        await hapusHariLibur(l.tanggal);
                        setPesan("Hari libur dihapus.");
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-muted">
        Cuti bersama memotong jatah cuti tahunan sesuai aturan perusahaan. Pemotongannya belum
        otomatis — untuk sekarang dicatat lewat pengajuan berjenis Cuti bersama.
      </p>
    </>
  );
}

export default function HalamanHariLibur() {
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER"]}>
      <Shell judul="Hari Libur" keterangan="Libur nasional, cuti bersama, dan libur perusahaan." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
