/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Mark native server modules as external for serverless builds
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcrypt"],
  },
};

export default nextConfig;
