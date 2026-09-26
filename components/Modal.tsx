"use client";

import { useEffect } from "react";

export default function Modal({
  judul,
  terbuka,
  onTutup,
  children,
}: {
  judul: string;
  terbuka: boolean;
  onTutup: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!terbuka) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onTutup();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [terbuka, onTutup]);

  if (!terbuka) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-allegro-800/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-5 py-3">
          <h2 className="font-bold text-allegro-700">{judul}</h2>
          <button onClick={onTutup} className="btn-ringan" aria-label="Tutup">
            Tutup
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
