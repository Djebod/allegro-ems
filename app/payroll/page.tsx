"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import {
  buatPayroll,
  pantauPayroll,
  semuaProyek,
  semuaSection,
  susunItemPayroll,
} from "@/lib/data";
import { seninMingguIni, tambahHari } from "@/lib/payroll";
import { keRupiah, rupiahPenuh } from "@/lib/rupiah";
import { tanggalPendek } from "@/lib/absensi";
import type { Payroll, Project, Section, StatusPayroll } from "@/types";

function warnaStatus(s: StatusPayroll) {
  if (s === "LOCKED") return "bg-allegro-700 text-white";
  if (s === "PAID") return "bg-green-100 text-green-800";
  if (s === "APPROVED") return "bg-allegro-100 text-allegro-700";
  if (s === "REVIEW") return "bg-kuning-400/40 text-allegro-700";
  return "bg-surface text-muted";
}

function Isi() {
  const { profile } = useAuth();
  const [daftar, setDaftar] = useState<Payroll[]>([]);
  const [proyek, setProyek] = useState<Project[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);

  const [buka, setBuka] = useState(false);
  const [pProyek, setPProyek] = useState("");
  const [pSection, setPSection] = useState("");
  const [pMulai, setPMulai] = useState(seninMingguIni());
  const [sibuk, setSibuk] = useState(false);
  const [catatan, setCatatan] = useState<string[]>([]);

  const pSelesai = tambahHari(pMulai, 6);

  useEffect(() => {
    semuaProyek().then(setProyek).catch(() => {});
    semuaSection().then(setSections).catch(() => {});
    return pantauPayroll(
      (d) => {
        setDaftar(d);
        setMemuat(false);
      },
      () => {
        setSalah("Data payroll tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
        setMemuat(false);
      }
    );
  }, []);

  const sectionProyek = useMemo(
    () => sections.filter((s) => s.projectId === pProyek),
    [sections, pProyek]
  );

  async function hitungDanSimpan() {
    setSalah(null);
    setCatatan([]);
    if (!pProyek) return setSalah("Proyek wajib dipilih.");
    if (!pSection) return setSalah("Section wajib dipilih.");

    setSibuk(true);
    try {
      const { items, masalah } = await susunItemPayroll({
        projectId: pProyek,
        sectionId: pSection,
        periodStart: pMulai,
        periodEnd: pSelesai,
      });

      if (items.length === 0) {
        setCatatan(masalah);
        setSibuk(false);
        return setSalah(
          "Tidak ada absensi pada section dan periode ini, jadi tidak ada yang bisa dihitung."
        );
      }

      const namaSection = sections.find((s) => s.id === pSection)?.name || pSection;
      const id = await buatPayroll({
        projectId: pProyek,
        sectionId: pSection,
        sectionName: namaSection,
        periodStart: pMulai,
        periodEnd: pSelesai,
        items,
        oleh: profile?.email || "",
      });

      setBuka(false);
      setCatatan(masalah);
      window.location.href = `/payroll/${id}`;
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Payroll gagal dibuat.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="mb-4">
        <button className="btn-utama" onClick={() => setBuka(true)}>
          Hitung payroll baru
        </button>
      </div>

      {salah && (
        <div className="mb-4">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}

      {memuat ? (
        <p className="text-muted">Memuat…</p>
      ) : daftar.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">
            Belum ada payroll. Pilih proyek, section, dan minggunya, lalu tekan Hitung.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tabel-padat">
            <thead>
              <tr>
                <th>Periode</th>
                <th>Proyek</th>
                <th>Section</th>
                <th className="text-right">Orang</th>
                <th className="text-right">Upah kotor</th>
                <th className="text-right">Potong bon</th>
                <th className="text-right">Dibayar</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">
                    {tanggalPendek(p.periodStart)} – {tanggalPendek(p.periodEnd)}
                  </td>
                  <td>{p.projectId}</td>
                  <td className="max-w-[140px]">
                    <p className="truncate">{p.sectionName}</p>
                  </td>
                  <td className="text-right">{p.totalEmployees}</td>
                  <td className="whitespace-nowrap text-right">{keRupiah(p.totalGrossPay)}</td>
                  <td className="whitespace-nowrap text-right text-muted">
                    {keRupiah(p.totalLoanDeduction)}
                  </td>
                  <td className="whitespace-nowrap text-right font-semibold text-ink">
                    {keRupiah(p.totalNetPay)}
                  </td>
                  <td>
                    <span className={`label-status ${warnaStatus(p.status)}`}>{p.status}</span>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Link className="btn-kuning" href={`/payroll/${p.id}`}>
                      Buka
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {catatan.length > 0 && (
        <details className="kartu mt-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Catatan perhitungan ({catatan.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {catatan.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </details>
      )}

      <Modal judul="Hitung payroll baru" terbuka={buka} onTutup={() => setBuka(false)}>
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <Field label="Proyek" wajib>
            <select
              className="input-dasar"
              value={pProyek}
              onChange={(e) => {
                setPProyek(e.target.value);
                setPSection("");
              }}
            >
              <option value="">— pilih proyek —</option>
              {proyek.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Section" wajib>
            <select
              className="input-dasar"
              value={pSection}
              onChange={(e) => setPSection(e.target.value)}
              disabled={!pProyek}
            >
              <option value="">{pProyek ? "— pilih section —" : "pilih proyek dulu"}</option>
              {sectionProyek.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Mulai periode (Senin)"
            wajib
            bantuan={`Periode berakhir ${pSelesai}. Satu payroll selalu tujuh hari.`}
          >
            <input
              type="date"
              className="input-dasar"
              value={pMulai}
              onChange={(e) => setPMulai(e.target.value)}
            />
          </Field>

          <button className="btn-utama w-full" onClick={hitungDanSimpan} disabled={sibuk}>
            {sibuk ? "Menghitung…" : "Hitung payroll"}
          </button>

          <p className="text-xs text-muted">
            Hasilnya tersimpan sebagai DRAFT dan masih bisa disesuaikan sebelum disahkan.
          </p>
        </div>
      </Modal>
    </>
  );
}

export default function HalamanPayroll() {
  return (
    <Guard izinkan={["ADMIN", "FINANCE"]}>
      <Shell judul="Payroll Mingguan" keterangan="Perhitungan upah per proyek dan section." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
