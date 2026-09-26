import type { Config } from "tailwindcss";

/**
 * Palet diambil langsung dari logo Allegro Global Construction:
 *   teal gelap  #19404F   (warna utama)
 *   kuning      #FAD131   (aksen / tombol lapangan)
 *   latar       #ECEBE7   (abu hangat)
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B2B33",
        muted: "#61727A",
        line: "#DAD8D2",
        surface: "#ECEBE7",
        allegro: {
          50: "#F1F4F5",
          100: "#D6E0E4",
          600: "#24576B",
          700: "#19404F",
          800: "#112E3A",
        },
        kuning: {
          300: "#FDE47A",
          400: "#FAD131",
          500: "#EFC117",
          600: "#CDA300",
        },
        bahaya: "#B3261E",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
