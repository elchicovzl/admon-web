/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundle mínimo autocontenido para la imagen Docker (~200MB vs ~1.5GB).
  // Next traza solo lo que el server realmente usa y lo deja en .next/standalone.
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
