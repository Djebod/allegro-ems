"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import TabelTimLapangan from "@/components/TabelTimLapangan";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { dbClient } from "@/lib/firebase";
import {
  pantauAbsensiHarian,
  pantauAbsensiProyek,
  pantauPekerjaProyek,
  pantauTimMandor,
  semuaProyek,
} from "@/lib/data";
import { tanggalHariIni, tanggalPendek } from "@/lib/absensi";
import type { Attendance, Employee, Project } from "@/types";

/** Peran yang boleh melihat tim proyek mana pun, bukan hanya proyek penugasannya. */
const PENGELOLA = ["ADMIN", "HR", "OWNER", "FINANCE"];

function Isi() {
  const { profile } = useAuth();
  const employeeId = profile?.employeeId || "";
  const peran = profile?.role || "";
  const pengelola = PENGELOLA.includes(peran);

  const [saya, setSaya] = useState<Employee | null | undefined>(undefined);
  const [proyek, setProyek] = useState<Project[]>([]);
  const [tanggal, setTanggal] = useState(tanggalHariIni());
  const [pilihProyek, setPilihProyek] = useState("");
  const [tim, setTim] = useState<Employee[] | null>(null);
  const [absensi, setAbsensi] = useState<Record<string, Attendance>>({});
  const [salah, setSalah] = useState<string | null>(null);

  useEffect(() => {
    semuaProyek()
      .then((p) => setProyek(p.sort((a, b) => a.code.localeCompare(b.code))))
      .catch(() => {});
    if (!employeeId) {
      setSaya(null);
      return;
    }
    getDoc(doc(dbClient(), "employees", employeeId))
      .then((s) => setSaya(s.exists() ? { id: s.id, ...(s.data() as Omit<Employee, "id">) } : null))
      .catch(() => setSaya(null));
  }, [employeeId]);

  // Mandor melihat timnya sendiri. Yang lain melihat proyek penugasannya;
  // pengelola tanpa penugasan boleh memilih proyek mana saja.
  const modeMandor = saya?.position === "MANDOR" || peran === "MANDOR";
  const projectId = modeMandor ? "" : saya?.currentProjectId || (pengelola ? pilihProyek : "");

  useEffect(() => {
    if (saya === undefined) return;
    setSalah(null);
    const gagal = () => {
      setSalah("Data tim tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
      setTim([]);
    };
    if (modeMandor && employeeId) {
      const a = pantauTimMandor(employeeId, setTim, gagal);
      const b = pantauAbsensiHarian(employeeId, tanggal, setAbsensi, () => setAbsensi({}));
      return () => {
        a();
        b();
      };
    }
    if (!projectId) {
      setTim([]);
      setAbsensi({});
      return;
    }
    const a = pantauPekerjaProyek(projectId, setTim, gagal);
    const b = pantauAbsensiProyek(projectId, tanggal, setAbsensi, () => setAbsensi({}));
    return () => {
      a();
      b();
    };
  }, [saya, modeMandor, employeeId, projectId, tanggal]);

  const namaProyek = (id: string | null | undefined) => proyek.find((p) => p.id === id)?.name || id || "-";
  const petaNama = useMemo(() => new Map((tim || []).map((k) => [k.id, k.name])), [tim]);
  const namaMandor = (id: string | null | undefined) => (id ? petaNama.get(id) || id : "-");

  const proyekTampil = modeMandor ? saya?.currentProjectId : projectId;
  const hadir = (tim || []).filter((k) => absensi[k.id]?.checkIn).length;
  const pulang = (tim || []).filter((k) => absensi[k.id]?.status === "SELESAI").length;

  if (saya === undefined) return <p className="text-muted">Memuat…</p>;

  if (!employeeId && !pengelola)
    return (
      <Pesan
        jenis="gagal"
        isi="Akun ini belum disambungkan ke data karyawan. Minta Admin membuka Pengguna & Peran, lalu memilih nama Anda."
      />
    );

  if (!modeMandor && !projectId && !pengelola)
    return (
      <div className="kartu">
        <p className="font-semibold text-ink">Anda belum ditugaskan ke proyek mana pun.</p>
        <p className="mt-1 text-sm text-muted">
          Halaman ini menampilkan tukang, kenek, dan mandor di proyek tempat Anda ditugaskan. Minta Admin mengisi
          penugasan proyek Anda di Data Karyawan.
        </p>
      </div>
    );

  return (
    <>
      <div className="kartu !p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Tanggal">
            <input
              type="date"
              className="input-dasar"
              value={tanggal}
              max={tanggalHariIni()}
              onChange={(e) => e.target.value && setTanggal(e.target.value)}
            />
          </Field>
          {!modeMandor && pengelola && !saya?.currentProjectId && (
            <Field label="Proyek">
              <select className="input-dasar" value={pilihProyek} onChange={(e) => setPilihProyek(e.target.value)}>
                <option value="">— pilih proyek —</option>
                {proyek.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex w-full flex-wrap gap-x-6 gap-y-2 text-sm sm:ml-auto sm:w-auto">
            {proyekTampil && (
              <span className="text-muted">
                Proyek <b className="text-ink">{namaProyek(proyekTampil)}</b>
              </span>
            )}
            <span className="text-muted">
              Tim <b className="text-ink">{tim?.length ?? 0}</b>
            </span>
            <span className="text-muted">
              Sudah masuk <b className="text-ink">{hadir}</b>
            </span>
            <span className="text-muted">
              Sudah pulang <b className="text-ink">{pulang}</b>
            </span>
          </div>
        </div>
      </div>

      {salah && (
        <div className="mt-4">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}

      <div className="mt-4">
        {tim === null ? (
          <p className="text-muted">Memuat…</p>
        ) : !modeMandor && !projectId ? (
          <div className="kartu text-center">
            <p className="text-sm text-muted">Pilih proyek dulu.</p>
          </div>
        ) : (
          <TabelTimLapangan
            tim={tim}
            absensi={absensi}
            namaMandor={modeMandor ? undefined : namaMandor}
            kosong={
              modeMandor
                ? "Belum ada tukang atau kenek yang ditugaskan di bawah Anda."
                : "Belum ada pekerja lapangan yang ditugaskan di proyek ini."
            }
          />
        )}
      </div>

      <p className="mt-2 text-xs text-muted">
        Jam {tanggalPendek(tanggal)}. Jam tebal berwarna adalah jam setelah dikoreksi Admin.
        {modeMandor && (
          <>
            {" "}
            Untuk mencatat absen, buka{" "}
            <Link href="/mandor" className="text-allegro-600 underline">
              Absen tim
            </Link>
            .
          </>
        )}
      </p>
    </>
  );
}

export default function HalamanTimLapangan() {
  return (
    <Guard izinkan={["ADMIN", "FINANCE", "MANDOR", "HR", "OWNER", "KARYAWAN"]}>
      <Shell
        judul="Tim Lapangan"
        keterangan="Daftar pekerja lapangan dan jam absennya hari ini: masuk, istirahat, lembur, pulang."
        lebar
      >
        <Isi />
      </Shell>
    </Guard>
  );
}
