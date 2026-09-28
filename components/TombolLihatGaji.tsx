"use client";

/**
 * Tombol kecil di sebelah judul kolom gaji. Bagi yang tidak berhak,
 * tombolnya mati dan hanya memberi keterangan.
 */
export default function TombolLihatGaji({
  tampil,
  boleh,
  ubah,
}: {
  tampil: boolean;
  boleh: boolean;
  ubah: (t: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => boleh && ubah(!tampil)}
      disabled={!boleh}
      title={boleh ? (tampil ? "Sembunyikan gaji" : "Tampilkan gaji") : "Hanya Owner, Finance, dan HR yang bisa melihat gaji"}
      className="ml-1 inline-flex items-center rounded border border-white/40 px-1.5 py-0.5 text-[10px] font-normal opacity-80 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {tampil ? "Sembunyikan" : "Tampilkan"}
    </button>
  );
}
