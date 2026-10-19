/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundle mínimo autocontenido para la imagen Docker (~200MB vs ~1.5GB).
  // Next traza solo lo que el server realmente usa y lo deja en .next/standalone.
  output: "standalone",
  // pdfkit (used by @react-pdf/renderer) loads its standard fonts with a
  // dynamic require, so the tracer misses them and the receipt PDF route
  // fails in the Docker image with "Cannot find module .../Helvetica.cjs".
  outputFileTracingIncludes: {
    "/dashboard/control/recibos/[id]/pdf": [
      "./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/**/*",
    ],
  },
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
