"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import { Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { semuaKaryawan, simpanImporKaryawan } from "@/lib/data";
import {
  bacaBerkasKaryawan,
  unduhTemplateKaryawan,
  type BarisImpor,
} from "@/lib/impor-karyawan";

function Isi() {
  const { profile } = useAuth();
  const [baris, setBaris] = useState<BarisImpor[]>([]);
  const [namaBerkas, setNamaBerkas] = useState("");
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  const bermasalah = useMemo(() => baris.filter((b) => b.masalah.length > 0), [baris]);
  const siap = useMemo(() => baris.filter((b) => b.masalah.length === 0), [baris]);

  async function pilih(file?: File) {
    if (!file) return;
    setSalah(null);
    setPesan(null);
    setSibuk(true);
    try {
      const sudahAda = await semuaKaryawan();
      const hasil = await bacaBerkasKaryawan(file, sudahAda);
      setBaris(hasil);
      setNamaBerkas(file.name);
      if (hasil.length === 0) setSalah("Tidak ada baris data yang terbaca di berkas itu.");
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Berkas tidak bisa dibaca.");
      setBaris([]);
    } finally {
      setSibuk(false);
      if (berkas.current) berkas.current.value = "";
    }
  }

  async function simpan() {
    setSibuk(true);
    setSalah(null);
    try {
      const hasil = await simpanImporKaryawan(siap, profile?.email || "");
      setBaris([]);
      setNamaBerkas("");
      setPesan(
        `${hasil.ditambah} karyawan ditambahkan, ${hasil.diperbarui} diperbarui.` +
          (bermasalah.length > 0
            ? ` ${bermasalah.length} baris bermasalah tidak ikut disimpan.`
            : "")
      );
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Data gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="kartu mb-4">
        <h2 className="font-semibold text-ink">Langkah pengisian</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted">
          <li>
            <strong className="text-ink">1.</strong> Unduh template, lalu isi datanya di Excel.
            Lembar <em>Petunjuk</em> di dalamnya menjelaskan tiap kolom.
          </li>
          <li>
            <strong className="text-ink">2.</strong> Simpan sebagai <strong>.xlsx</strong>, lalu
            unggah di sini.
          </li>
          <li>
            <strong className="text-ink">3.</strong> Periksa pratinjaunya. Baris bermasalah
            disebutkan alasannya dan tidak ikut disimpan.
          </li>
        </ol>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-ringan" onClick={unduhTemplateKaryawan}>
            Unduh template Excel
          </button>
          <input
            ref={berkas}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => pilih(e.target.files?.[0])}
          />
          <button className="btn-utama" disabled={sibuk} onClick={() => berkas.current?.click()}>
            {sibuk ? "Membaca…" : "Unggah berkas terisi"}
          </button>
          <Link href="/admin/karyawan" className="btn-ringan">
            Daftar karyawan
          </Link>
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

      {baris.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-line bg-white px-5 py-3">
            <div>
              <p className="text-[11px] text-muted">Berkas</p>
              <p className="font-semibold text-ink">{namaBerkas}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">Siap disimpan</p>
              <p className="text-lg font-bold leading-tight text-ink">{siap.length}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">Bermasalah</p>
              <p
                className={`text-lg font-bold leading-tight ${
                  bermasalah.length > 0 ? "text-bahaya" : "text-ink"
                }`}
              >
                {bermasalah.length}
              </p>
            </div>
            <button
              className="btn-utama ml-auto"
              disabled={sibuk || siap.length === 0}
              onClick={simpan}
            >
              {sibuk ? "Menyimpan…" : `Simpan ${siap.length} baris`}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="tabel-padat">
              <thead>
                <tr>
                  <th>Baris</th>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>NIK</th>
                  <th>Posisi</th>
                  <th>Divisi</th>
                  <th>Jadwal</th>
                  <th>Tindakan</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => (
                  <tr key={b.nomorBaris}>
                    <td className="text-muted">{b.nomorBaris}</td>
                    <td className="whitespace-nowrap font-semibold text-ink">
                      {b.data.employeeCode}
                    </td>
                    <td className="max-w-[190px]">
                      <p className="truncate">{b.data.name}</p>
                    </td>
                    <td className="whitespace-nowrap text-muted">{b.data.nik}</td>
                    <td>{b.data.position}</td>
                    <td className="text-muted">{b.data.divisi || "—"}</td>
                    <td className="whitespace-nowrap text-muted">
                      {b.data.jamMasuk || "—"}–{b.data.jamPulang || "—"}
                    </td>
                    <td>
                      {b.masalah.length > 0 ? (
                        <span className="label-status bg-red-100 text-bahaya">DILEWATI</span>
                      ) : b.memperbarui ? (
                        <span className="label-status bg-kuning-400/40 text-allegro-700">
                          PERBARUI
                        </span>
                      ) : (
                        <span className="label-status bg-green-100 text-green-800">BARU</span>
                      )}
                    </td>
                    <td className="max-w-[320px]">
                      <p className={b.masalah.length > 0 ? "text-bahaya" : "text-muted"}>
                        {b.masalah.length > 0 ? b.masalah.join(" ") : "—"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-muted">
            Kode karyawan yang sudah ada akan <strong>diperbarui</strong>, bukan dibuat ganda. Kolom
            yang dikosongkan di berkas tidak menimpa data lama, jadi impor sebagian aman dilakukan.
            NIK tidak bisa diubah lewat impor.
          </p>
        </>
      )}
    </>
  );
}

export default function HalamanImporKaryawan() {
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER"]}>
      <Shell judul="Impor Data Karyawan" keterangan="Isi lewat Excel, unggah sekali jadi." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
