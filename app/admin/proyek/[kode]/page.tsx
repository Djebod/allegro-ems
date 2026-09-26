"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import {
  ambilProyek,
  buatSection,
  pantauSection,
  rapikanKode,
  ubahProyek,
  ubahSection,
} from "@/lib/data";
import { bacaKoordinat } from "@/lib/lokasi";
import type { Project, ProjectStatus, Section } from "@/types";

const STATUS: ProjectStatus[] = ["ACTIVE", "COMPLETED", "SUSPENDED", "ARCHIVED"];

function Isi({ kode }: { kode: string }) {
  const [proyek, setProyek] = useState<Project | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState<string | null>(null);
  const [salah, setSalah] = useState<string | null>(null);

  const [bukaSection, setBukaSection] = useState(false);
  const [sKode, setSKode] = useState("");
  const [sNama, setSNama] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  const [bukaEdit, setBukaEdit] = useState(false);
  const [eNama, setENama] = useState("");
  const [eAlamat, setEAlamat] = useState("");
  const [eKoordinat, setEKoordinat] = useState("");
  const [eRadius, setERadius] = useState("");
  const [eStatus, setEStatus] = useState<ProjectStatus>("ACTIVE");

  useEffect(() => {
    ambilProyek(kode)
      .then((p) => {
        setProyek(p);
        setMemuat(false);
      })
      .catch(() => setMemuat(false));

    return pantauSection(kode, setSections, () =>
      setSalah("Daftar section tidak bisa dibaca. Periksa Security Rules.")
    );
  }, [kode]);

  function bukaFormEdit() {
    if (!proyek) return;
    setENama(proyek.name);
    setEAlamat(proyek.address);
    setEKoordinat(`${proyek.latitude}, ${proyek.longitude}`);
    setERadius(String(proyek.attendanceRadiusMeter));
    setEStatus(proyek.status);
    setSalah(null);
    setBukaEdit(true);
  }

  async function simpanEdit() {
    if (!proyek) return;
    setSalah(null);
    const titik = bacaKoordinat(eKoordinat);
    if (!titik) return setSalah("Koordinat belum benar. Contoh: -6.7320, 108.5523");
    const radius = Number(eRadius);
    if (!Number.isFinite(radius) || radius < 50 || radius > 5000) {
      return setSalah("Radius absensi harus antara 50 dan 5000 meter.");
    }

    setMenyimpan(true);
    try {
      await ubahProyek(proyek.id, {
        name: eNama.trim(),
        address: eAlamat.trim(),
        latitude: titik.lat,
        longitude: titik.lng,
        attendanceRadiusMeter: radius,
        status: eStatus,
      });
      setProyek(await ambilProyek(kode));
      setBukaEdit(false);
      setPesan("Perubahan proyek tersimpan.");
    } catch {
      setSalah("Perubahan gagal disimpan.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function simpanSection() {
    setSalah(null);
    if (!rapikanKode(sKode)) return setSalah("Kode section wajib diisi.");
    if (!sNama.trim()) return setSalah("Nama section wajib diisi.");

    setMenyimpan(true);
    try {
      await buatSection({
        projectId: kode,
        code: sKode,
        name: sNama.trim(),
        description: "",
        status: "ACTIVE",
      });
      setSKode("");
      setSNama("");
      setBukaSection(false);
      setPesan("Section ditambahkan.");
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Section gagal disimpan.");
    } finally {
      setMenyimpan(false);
    }
  }

  if (memuat) return <p className="text-muted">Memuat…</p>;

  if (!proyek)
    return (
      <div className="kartu">
        <p className="text-sm text-muted">Proyek tidak ditemukan.</p>
        <Link href="/admin/proyek" className="btn-ringan mt-4 inline-flex">
          Kembali ke daftar proyek
        </Link>
      </div>
    );

  return (
    <>
      {pesan && (
        <div className="mb-4">
          <Pesan jenis="berhasil" isi={pesan} />
        </div>
      )}

      <div className="kartu">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted">{proyek.code}</p>
            <h2 className="text-lg font-bold text-ink">{proyek.name}</h2>
            <p className="mt-1 text-sm text-muted">{proyek.address}</p>
          </div>
          <button className="btn-ringan" onClick={bukaFormEdit}>
            Ubah
          </button>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Status</dt>
            <dd className="font-medium text-ink">{proyek.status}</dd>
          </div>
          <div>
            <dt className="text-muted">Radius absensi</dt>
            <dd className="font-medium text-ink">{proyek.attendanceRadiusMeter} meter</dd>
          </div>
          <div>
            <dt className="text-muted">Koordinat</dt>
            <dd className="font-medium text-ink">
              <a
                className="underline decoration-line underline-offset-2 hover:text-allegro-700"
                href={`https://www.google.com/maps?q=${proyek.latitude},${proyek.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {proyek.latitude}, {proyek.longitude}
              </a>
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-allegro-700">Section</h2>
        <button className="btn-utama" onClick={() => setBukaSection(true)}>
          Tambah section
        </button>
      </div>

      {salah && (
        <div className="mt-3">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}

      <div className="mt-3 space-y-3">
        {sections.length === 0 ? (
          <div className="kartu text-center">
            <p className="text-sm text-muted">
              Belum ada section. Section dipakai untuk memisahkan payroll, misalnya Struktur,
              Finishing, atau Instalasi.
            </p>
          </div>
        ) : (
          sections.map((s) => (
            <div key={s.id} className="kartu flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted">{s.code}</p>
                <p className="font-semibold text-ink">{s.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`label-status ${
                    s.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-surface text-muted"
                  }`}
                >
                  {s.status}
                </span>
                <button
                  className="btn-ringan"
                  onClick={() =>
                    ubahSection(s.id, { status: s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })
                  }
                >
                  {s.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal judul="Section baru" terbuka={bukaSection} onTutup={() => setBukaSection(false)}>
        <div className="space-y-4">
          <Field label="Kode section" wajib bantuan="Tidak bisa diubah setelah disimpan. Contoh: STR">
            <input className="input-dasar" value={sKode} onChange={(e) => setSKode(e.target.value)} />
          </Field>
          <Field label="Nama section" wajib>
            <input
              className="input-dasar"
              value={sNama}
              onChange={(e) => setSNama(e.target.value)}
              placeholder="Struktur"
            />
          </Field>
          <button className="btn-utama w-full" onClick={simpanSection} disabled={menyimpan}>
            {menyimpan ? "Menyimpan…" : "Simpan section"}
          </button>
        </div>
      </Modal>

      <Modal judul="Ubah proyek" terbuka={bukaEdit} onTutup={() => setBukaEdit(false)}>
        <div className="space-y-4">
          <Field label="Nama proyek" wajib>
            <input className="input-dasar" value={eNama} onChange={(e) => setENama(e.target.value)} />
          </Field>
          <Field label="Alamat" wajib>
            <textarea
              className="input-dasar"
              rows={2}
              value={eAlamat}
              onChange={(e) => setEAlamat(e.target.value)}
            />
          </Field>
          <Field label="Koordinat" wajib>
            <input
              className="input-dasar"
              value={eKoordinat}
              onChange={(e) => setEKoordinat(e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Radius absensi (meter)" wajib>
              <input
                className="input-dasar"
                inputMode="numeric"
                value={eRadius}
                onChange={(e) => setERadius(e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select
                className="input-dasar"
                value={eStatus}
                onChange={(e) => setEStatus(e.target.value as ProjectStatus)}
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button className="btn-utama w-full" onClick={simpanEdit} disabled={menyimpan}>
            {menyimpan ? "Menyimpan…" : "Simpan perubahan"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default function HalamanDetailProyek() {
  const params = useParams<{ kode: string }>();
  const kode = decodeURIComponent(String(params.kode));

  return (
    <Guard izinkan={["ADMIN"]}>
      <Shell
        judul="Detail proyek"
        keterangan="Ubah lokasi dan kelola section di sini."
        aksi={
          <Link href="/admin/proyek" className="btn-ringan">
            Daftar proyek
          </Link>
        }
      >
        <Isi kode={kode} />
      </Shell>
    </Guard>
  );
}
