/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  webpack: (config) => {
    // face-api (TensorFlow.js) memuat pustaka node secara dinamis bila ada;
    // di browser cabang itu tidak pernah jalan. Peringatannya saja yang dibungkam.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /@vladmandic\/face-api/, message: /Critical dependency/ },
    ];
    return config;
  },
};

export default nextConfig;
