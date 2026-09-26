import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Absensi & Payroll — Allegro Global Construction",
    template: "%s · Allegro Global Construction",
  },
  description:
    "Pencatatan absensi lapangan dan penggajian mingguan proyek Allegro Global Construction.",
};

export const viewport: Viewport = {
  themeColor: "#19404F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
