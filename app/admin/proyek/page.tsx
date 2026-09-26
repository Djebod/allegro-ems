"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { buatProyek, pantauProyek, rapikanKode } from "@/lib/data";
import { bacaKoordinat } from "@/lib/lokasi";
import { DEFAULT_ATTENDANCE_RADIUS_METER } from "@/lib/constants";
import type { Project, ProjectStatus } from "@/types";

const STATUS: ProjectStatus[] = ["ACTIVE", "COMPLETED", "SUSPENDED", "ARCHIVED"];

const kosong = {
  code: "",
  name: "",
  address: "",
  koordinat: "",
  attendanceRadiusMeter: String(DEFAULT_ATTENDANCE_RADIUS_METER),
  status: "ACTIVE" as ProjectStatus,
  startDate: "",
  description: "",
};

function warnaStatus(s: ProjectStatus) {
  if (s === "ACTIVE") return "bg-green-100 text-green-800";
  if (s === "COMPLETED") return "bg-allegro-100 text-allegro-700";
  return "bg-surface text-muted";
}

function IsiHalaman() {
  const [proyek, setProyek] = useState<Project[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagalBaca, setGagalBaca] = useState(false);

  const [buka, setBuka] = useState(false);
  const [form, setForm] = useState(kosong);
  const [salah, setSalah] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    return pantauProyek(
      (d) => {
        setProyek(d);
        setMemuat(false);
      },
      () => {
        setGagalBaca(true);
        setMemuat(false);
      }
    );
  }, []);

  function isi(k: keyof typeof kosong, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function pakaiLokasiSaya() {
    if (!navigator.geolocation) {
      setSalah("Perangkat ini tidak mendukung pengambilan lokasi.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => isi("koordinat", `${pos.coords.latitude}, ${pos.coords.longitude}`),
      () => setSalah("Lokasi tidak bisa diambil. Izinkan akses lokasi di browser."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function simpan() {
    setSalah(null);

    const kode = rapikanKode(form.code);
    if (!kode) return setSalah("Kode proyek wajib diisi.");
    if (!form.name.trim()) return setSalah("Nama proyek wajib diisi.");
    if (!form.address.trim()) return setSalah("Alamat wajib diisi.");

    const titik = bacaKoordinat(form.koordinat);
    if (!titik) return setSalah("Koordinat belum benar. Contoh: -6.7320, 108.5523");

    const radius = Number(form.attendanceRadiusMeter);
    if (!Number.isFinite(radius) || radius < 50 || radius > 5000) {
      return setSalah("Radius absensi harus antara 50 dan 5000 meter.");
    }

    setMenyimpan(true);
    try {
      await buatProyek({
        code: kode,
        name: form.name.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        latitude: titik.lat,
        longitude: titik.lng,
        attendanceRadiusMeter: radius,
        status: form.status,
        startDate: form.startDate || "",
        endDate: null,
      });
      setForm(kosong);
      setBuka(false);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Proyek gagal disimpan.");
    } finally {
      setMenyimpan(false);
    }
  }

  if (memuat) return <p className="text-muted">Memuat daftar proyek…</p>;

  if (gagalBaca)
    return (
      <Pesan
        jenis="gagal"
        isi="Data proyek tidak bisa dibaca. Pastikan firestore.rules versi terbaru sudah di-publish di Firebase Console."
      />
    );

  return (
    <>
      <div className="mb-4">
        <button className="btn-utama" onClick={() => setBuka(true)}>
          Tambah proyek
        </button>
      </div>

      {proyek.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">
            Belum ada proyek. Tambahkan proyek pertama beserta titik lokasinya, karena absensi
            nanti diukur dari titik itu.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {proyek.map((p) => (
            <Link key={p.id} href={`/admin/proyek/${p.id}`} className="kartu hover:border-allegro-600">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted">{p.code}</p>
                  <h2 className="font-semibold text-ink">{p.name}</h2>
                </div>
                <span className={`label-status ${warnaStatus(p.status)}`}>{p.status}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{p.address}</p>
              <p className="mt-2 text-xs text-muted">
                Radius absensi {p.attendanceRadiusMeter} m
              </p>
            </Link>
          ))}
        </div>
      )}

      <Modal judul="Proyek baru" terbuka={buka} onTutup={() => setBuka(false)}>
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <Field label="Kode proyek" wajib bantuan="Tidak bisa diubah setelah disimpan. Contoh: AGC-01">
            <input
              className="input-dasar"
              value={form.code}
              onChange={(e) => isi("code", e.target.value)}
              placeholder="AGC-01"
            />
          </Field>

          <Field label="Nama proyek" wajib>
            <input
              className="input-dasar"
              value={form.name}
              onChange={(e) => isi("name", e.target.value)}
              placeholder="Pembangunan Gudang Plered"
            />
          </Field>

          <Field label="Alamat lokasi" wajib>
            <textarea
              className="input-dasar"
              rows={2}
              value={form.address}
              onChange={(e) => isi("address", e.target.value)}
            />
          </Field>

          <Field
            label="Koordinat lokasi"
            wajib
            bantuan="Boleh ditempel dari Google Maps, atau tekan tombol di bawah bila sedang berada di lokasi."
          >
            <input
              className="input-dasar"
              value={form.koordinat}
              onChange={(e) => isi("koordinat", e.target.value)}
              placeholder="-6.7320, 108.5523"
            />
          </Field>
          <button type="button" className="btn-ringan" onClick={pakaiLokasiSaya}>
            Gunakan lokasi saya sekarang
          </button>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Radius absensi (meter)" wajib>
              <input
                className="input-dasar"
                inputMode="numeric"
                value={form.attendanceRadiusMeter}
                onChange={(e) => isi("attendanceRadiusMeter", e.target.value)}
              />
            </Field>

            <Field label="Status">
              <select
                className="input-dasar"
                value={form.status}
                onChange={(e) => isi("status", e.target.value)}
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Tanggal mulai">
            <input
              type="date"
              className="input-dasar"
              value={form.startDate}
              onChange={(e) => isi("startDate", e.target.value)}
            />
          </Field>

          <Field label="Keterangan">
            <textarea
              className="input-dasar"
              rows={2}
              value={form.description}
              onChange={(e) => isi("description", e.target.value)}
            />
          </Field>

          <button className="btn-utama w-full" onClick={simpan} disabled={menyimpan}>
            {menyimpan ? "Menyimpan…" : "Simpan proyek"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default function HalamanProyek() {
  return (
    <Guard izinkan={["ADMIN"]}>
      <Shell judul="Proyek" keterangan="Titik koordinat di sini yang dipakai untuk memeriksa absensi.">
        <IsiHalaman />
      </Shell>
    </Guard>
  );
}
