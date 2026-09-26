"use client";

/**
 * Penanda kesesuaian lokasi. Sengaja dihitung ulang saat ditampilkan,
 * bukan disimpan sebagai kata "sesuai" di database — supaya kalau radius
 * proyek diubah Admin, catatan lama dinilai dengan ukuran yang berlaku
 * sekarang, bukan dengan penilaian yang sudah membeku.
 */
export default function BadgeLokasi({
  jarakMeter,
  radiusMeter,
  ringkas,
}: {
  jarakMeter?: number | null;
  radiusMeter: number;
  ringkas?: boolean;
}) {
  if (jarakMeter === null || jarakMeter === undefined) {
    return <span className="label-status bg-surface text-muted">Lokasi tidak tercatat</span>;
  }

  const sesuai = jarakMeter <= radiusMeter;

  return (
    <span
      className={`label-status ${
        sesuai ? "bg-green-100 text-green-800" : "bg-red-100 text-bahaya"
      }`}
    >
      {sesuai ? "Sesuai lokasi" : "Di luar lokasi"}
      {!ringkas && ` · ${jarakMeter} m`}
    </span>
  );
}
