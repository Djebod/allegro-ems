"use client";

import { useEffect, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { buatKantor, pantauKantor, ubahKantor } from "@/lib/data-kantor";
import { bacaKoordinat } from "@/lib/lokasi";
import { rapikanKode } from "@/lib/data";
import type { Kantor } from "@/types";

const kosong = { code: "", nama: "", alamat: "", koordinat: "", radius: "100" };

function Isi() {
  const [daftar, setDaftar] = useState<Kantor[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const [buka, setBuka] = useState(false);
  const [ubahId, setUbahId] = useState<string | null>(null);
  const [form, setForm] = useState(kosong);

  useEffect(() => {
    return pantauKantor(
      (d) => {
        setDaftar(d);
        setMemuat(false);
      },
      () => {
        setSalah("Data kantor tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
        setMemuat(false);
      }
    );
  }, []);

  function isi(k: keyof typeof kosong, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function pakaiLokasiSaya() {
    if (!navigator.geolocation) return setSalah("Perangkat ini tidak mendukung GPS.");
    navigator.geolocation.getCurrentPosition(
      (pos) => isi("koordinat", `${pos.coords.latitude}, ${pos.coords.longitude}`),
      () => setSalah("Lokasi tidak bisa diambil. Izinkan akses lokasi di browser."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function simpan() {
    setSalah(null);
    const titik = bacaKoordinat(form.koordinat);
    if (!ubahId && !rapikanKode(form.code)) return setSalah("Kode kantor wajib diisi.");
    if (!form.nama.trim()) return setSalah("Nama kantor wajib diisi.");
    if (!titik) return setSalah("Koordinat belum benar. Contoh: -6.9175, 107.6191");
    const radius = Number(form.radius);
    if (!Number.isFinite(radius) || radius < 20 || radius > 2000) {
      return setSalah("Radius harus antara 20 dan 2000 meter.");
    }

    setSibuk(true);
    try {
      if (ubahId) {
        await ubahKantor(ubahId, {
          nama: form.nama.trim(),
          alamat: form.alamat.trim(),
          latitude: titik.lat,
          longitude: titik.lng,
          radiusMeter: radius,
        });
        setPesan("Kantor diperbarui.");
      } else {
        await buatKantor({
          code: form.code,
          nama: form.nama.trim(),
          alamat: form.alamat.trim(),
          latitude: titik.lat,
          longitude: titik.lng,
          radiusMeter: radius,
          status: "ACTIVE",
        });
        setPesan("Kantor ditambahkan.");
      }
      setBuka(false);
      setUbahId(null);
      setForm(kosong);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Kantor gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="mb-4">
        <button
          className="btn-utama"
          onClick={() => {
            setForm(kosong);
            setUbahId(null);
            setSalah(null);
            setBuka(true);
          }}
        >
          Tambah kantor
        </button>
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
      ) : daftar.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">
            Belum ada kantor. Tambahkan kantor beserta titik koordinatnya — absensi staf kantor
            diukur dari titik itu.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {daftar.map((k) => (
            <div key={k.id} className="kartu">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted">{k.code}</p>
                  <h2 className="font-semibold text-ink">{k.nama}</h2>
                  <p className="mt-1 text-sm text-muted">{k.alamat || "—"}</p>
                </div>
                <span
                  className={`label-status ${
                    k.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-surface text-muted"
                  }`}
                >
                  {k.status}
                </span>
              </div>

              <p className="mt-3 text-xs text-muted">
                Radius {k.radiusMeter} m ·{" "}
                <a
                  className="underline decoration-line underline-offset-2"
                  href={`https://www.google.com/maps?q=${k.latitude},${k.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {k.latitude}, {k.longitude}
                </a>
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  className="btn-ringan"
                  onClick={() => {
                    setUbahId(k.id);
                    setForm({
                      code: k.code,
                      nama: k.nama,
                      alamat: k.alamat,
                      koordinat: `${k.latitude}, ${k.longitude}`,
                      radius: String(k.radiusMeter),
                    });
                    setSalah(null);
                    setBuka(true);
                  }}
                >
                  Ubah
                </button>
                <button
                  className="btn-ringan"
                  onClick={() =>
                    ubahKantor(k.id, { status: k.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })
                  }
                >
                  {k.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Saat absen, sistem mengukur jarak ke <strong>seluruh kantor aktif</strong>, lalu memakai
        yang terdekat. Jadi orang Bandung yang sedang di kantor Jakarta tetap terhitung berada di
        kantor, bukan di luar jangkauan.
      </p>

      <Modal
        judul={ubahId ? "Ubah kantor" : "Kantor baru"}
        terbuka={buka}
        onTutup={() => setBuka(false)}
      >
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          {!ubahId && (
            <Field label="Kode kantor" wajib bantuan="Tidak bisa diubah. Contoh: BDG, JKT.">
              <input
                className="input-dasar"
                value={form.code}
                onChange={(e) => isi("code", e.target.value)}
                placeholder="BDG"
              />
            </Field>
          )}

          <Field label="Nama kantor" wajib>
            <input
              className="input-dasar"
              value={form.nama}
              onChange={(e) => isi("nama", e.target.value)}
              placeholder="Kantor Bandung"
            />
          </Field>

          <Field label="Alamat">
            <textarea
              className="input-dasar"
              rows={2}
              value={form.alamat}
              onChange={(e) => isi("alamat", e.target.value)}
            />
          </Field>

          <Field
            label="Koordinat"
            wajib
            bantuan="Buka Google Maps, klik kanan di titik kantor, klik angka koordinat yang muncul."
          >
            <input
              className="input-dasar"
              value={form.koordinat}
              onChange={(e) => isi("koordinat", e.target.value)}
              placeholder="-6.9175, 107.6191"
            />
          </Field>
          <button type="button" className="btn-ringan" onClick={pakaiLokasiSaya}>
            Gunakan lokasi saya sekarang
          </button>

          <Field label="Radius absen (meter)" wajib bantuan="Bawaannya 100 meter.">
            <input
              className="input-dasar max-w-[10rem]"
              inputMode="numeric"
              value={form.radius}
              onChange={(e) => isi("radius", e.target.value.replace(/\D/g, ""))}
            />
          </Field>

          {Number(form.radius) > 0 && Number(form.radius) < 80 && (
            <p className="text-xs text-bahaya">
              Radius {form.radius} meter terlalu sempit. GPS ponsel biasanya meleset 20 sampai 150
              meter, apalagi di dalam gedung — dengan radius sesempit ini, orang yang benar-benar
              berada di kantor pun akan sering tertolak. Sebaiknya minimal 100 meter.
            </p>
          )}

          <button className="btn-utama w-full" onClick={simpan} disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan kantor"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default function HalamanKantor() {
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER"]}>
      <Shell judul="Kantor" keterangan="Titik lokasi dan radius absensi staf kantor." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
