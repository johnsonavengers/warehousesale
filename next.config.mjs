/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Sertifikat CA harus tersedia juga di fungsi Vercel untuk sslrootcert.
    outputFileTracingIncludes: {
      "/*": ["./certs/supabase-prod-ca-2021.crt"],
    },
    serverComponentsExternalPackages: [
      "better-sqlite3",
      "@prisma/adapter-better-sqlite3",
      "@prisma/adapter-pg",
      "pg",
    ],
  },
};

export default nextConfig;
