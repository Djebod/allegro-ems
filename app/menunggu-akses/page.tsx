"use client";

import Image from "next/image";
import { useAuth } from "@/lib/auth";

export default function MenungguAkses() {
  const { profile, user, keluar } = useAuth();
  const nonaktif = profile?.status === "INACTIVE";

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="kartu w-full max-w-md text-center">
        <Image
          src="/mark.png"
          alt=""
          width={48}
          height={48}
          className="mx-auto mb-4"
        />
        <h1 className="text-xl font-bold text-allegro-700">
          {nonaktif ? "Akun dinonaktifkan" : "Menunggu persetujuan Admin"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {nonaktif
            ? "Akun ini sudah dinonaktifkan. Hubungi Admin bila menurut Anda ini keliru."
            : "Akun Anda sudah terdaftar tetapi belum diberi peran. Hubungi Admin dan sebutkan email di bawah ini."}
        </p>
        <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-sm font-medium text-ink">
          {user?.email}
        </p>
        <button onClick={keluar} className="btn-ringan mt-6">
          Keluar
        </button>
      </div>
    </div>
  );
}
