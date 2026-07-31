/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      "firebase-admin",
      "pdfkit",
      "fontkit",
    ],
  },
};

export default nextConfig;
