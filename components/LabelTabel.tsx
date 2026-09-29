"use client";

import { useEffect } from "react";
import { labeliTabel } from "@/lib/label-tabel";

/** Memasang label kolom pada semua tabel, dan terus memperbaruinya saat isi tabel berubah. */
export default function LabelTabel() {
  useEffect(() => {
    let jadwal = 0;
    const jalankan = () => {
      cancelAnimationFrame(jadwal);
      jadwal = requestAnimationFrame(() => labeliTabel(document));
    };
    jalankan();
    const pengamat = new MutationObserver(jalankan);
    pengamat.observe(document.body, { childList: true, subtree: true });
    return () => {
      pengamat.disconnect();
      cancelAnimationFrame(jadwal);
    };
  }, []);
  return null;
}
