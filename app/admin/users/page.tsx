"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import { dbClient, SUPER_ADMIN_EMAIL } from "@/lib/firebase";
import type { AppUser, RoleOrPending, UserStatus } from "@/types";

const PERAN: RoleOrPending[] = [
  "PENDING",
  "ADMIN",
  "HR",
  "OWNER",
  "FINANCE",
  "MANDOR",
  "KARYAWAN",
];

function warnaStatus(status: UserStatus) {
  if (status === "ACTIVE") return "bg-green-100 text-green-800";
  if (status === "INACTIVE") return "bg-red-100 text-bahaya";
  return "bg-kuning-400/40 text-allegro-700";
}

function DaftarPengguna() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [mandor, setMandor] = useState<{ id: string; name: string }[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    // Seluruh karyawan aktif, untuk menyambungkan akun login dengan data
    // karyawannya. Sambungan ini yang dipakai saldo cuti dan absensi.
    const lepasMandor = onSnapshot(
      query(collection(dbClient(), "employees"), where("status", "==", "ACTIVE")),
      (snap) =>
        setMandor(snap.docs.map((d) => ({ id: d.id, name: String(d.data().name || d.id) }))),
      () => setMandor([])
    );

    const lepasUsers = onSnapshot(
      collection(dbClient(), "users"),
      (snap) => {
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<AppUser, "uid">) })));
        setMemuat(false);
      },
      () => {
        setPesan("Data pengguna tidak bisa dibaca. Periksa Security Rules.");
        setMemuat(false);
      }
    );

    return () => {
      lepasMandor();
      lepasUsers();
    };
  }, []);

  async function ubah(uid: string, data: Partial<AppUser>) {
    setPesan(null);
    try {
      await updateDoc(doc(dbClient(), "users", uid), { ...data, updatedAt: serverTimestamp() });
      setPesan("Perubahan tersimpan.");
    } catch {
      setPesan("Perubahan gagal disimpan. Periksa koneksi dan Security Rules.");
    }
  }

  if (memuat) return <p className="text-muted">Memuat daftar pengguna…</p>;

  if (users.length === 0)
    return (
      <div className="kartu text-center">
        <p className="text-sm text-muted">
          Belum ada pengguna lain. Minta mereka login dengan Google sekali, lalu peran bisa
          diberikan dari halaman ini.
        </p>
      </div>
    );

  return (
    <>
      {pesan && (
        <p className="mb-4 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink">
          {pesan}
        </p>
      )}

      <div className="space-y-3">
        {users.map((u) => {
          const superAdmin = u.email === SUPER_ADMIN_EMAIL;
          return (
            <div key={u.uid} className="kartu">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{u.name}</p>
                  <p className="truncate text-sm text-muted">{u.email}</p>
                </div>
                <span className={`label-status ${warnaStatus(u.status)}`}>{u.status}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="text-sm text-muted" htmlFor={`peran-${u.uid}`}>
                  Peran
                </label>
                <select
                  id={`peran-${u.uid}`}
                  className="input-dasar max-w-[10rem]"
                  value={u.role}
                  disabled={superAdmin}
                  onChange={(e) =>
                    ubah(u.uid, {
                      role: e.target.value as RoleOrPending,
                      status: e.target.value === "PENDING" ? "PENDING" : "ACTIVE",
                    })
                  }
                >
                  {PERAN.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                {!superAdmin && u.role !== "PENDING" && (
                  <button
                    className="btn-ringan"
                    onClick={() =>
                      ubah(u.uid, { status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })
                    }
                  >
                    {u.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                )}

                {superAdmin && <span className="text-xs text-muted">Super admin, tidak bisa diubah</span>}
              </div>

              {u.role !== "PENDING" && (
                <div className="mt-4 rounded-lg border border-line p-3">
                  <label className="mb-1 block text-sm font-medium text-ink" htmlFor={`kar-${u.uid}`}>
                    Akun ini adalah karyawan
                  </label>
                  <select
                    id={`kar-${u.uid}`}
                    className="input-dasar max-w-xs"
                    value={u.employeeId || ""}
                    onChange={(e) => ubah(u.uid, { employeeId: e.target.value || null })}
                  >
                    <option value="">— belum dipilih —</option>
                    {mandor.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.id})
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-muted">
                    Wajib diisi. Tanpa sambungan ini, orang tersebut tidak punya saldo cuti dan
                    tidak bisa mengajukan apa pun atas namanya sendiri.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function HalamanPengguna() {
  return (
    <Guard izinkan={["ADMIN"]}>
      <Shell
        judul="Pengguna & Peran"
        keterangan="Setiap orang harus login Google sekali sebelum bisa diberi peran."
      >
        <DaftarPengguna />
      </Shell>
    </Guard>
  );
}
