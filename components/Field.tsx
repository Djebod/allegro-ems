"use client";

export function Field({
  label,
  wajib,
  bantuan,
  children,
}: {
  label: string;
  wajib?: boolean;
  bantuan?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">
        {label}
        {wajib && <span className="text-bahaya"> *</span>}
      </span>
      {children}
      {bantuan && <span className="mt-1 block text-xs text-muted">{bantuan}</span>}
    </label>
  );
}

export function Pesan({ isi, jenis }: { isi: string; jenis: "gagal" | "berhasil" }) {
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm ${
        jenis === "gagal" ? "bg-red-50 text-bahaya" : "bg-allegro-50 text-allegro-700"
      }`}
    >
      {isi}
    </p>
  );
}
