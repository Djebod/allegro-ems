"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, berandaUntuk } from "@/lib/auth";
import type { Role } from "@/types";

/**
 * Pagar halaman di sisi tampilan. Ini HANYA untuk kenyamanan pengguna.
 * Keamanan sebenarnya ada di Firestore Security Rules.
 */
export default function Guard({
  izinkan,
  children,
}: {
  izinkan: Role[];
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const role = profile?.role ?? null;
    const aktif = profile?.status === "ACTIVE";
    if (!aktif || !role || role === "PENDING" || !izinkan.includes(role)) {
      router.replace(berandaUntuk(aktif ? role : "PENDING"));
    }
  }, [loading, user, profile, izinkan, router]);

  if (loading || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted">Memuat…</p>
      </div>
    );
  }

  const role = profile.role;
  if (profile.status !== "ACTIVE" || role === "PENDING" || !izinkan.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
