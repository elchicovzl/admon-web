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
  // pg-boss is ESM-only and pulls in `pg`; keep it out of the server bundle so
  // it loads from node_modules (traced into the standalone output).
  // The knowledge-base parsers load from node_modules too: unpdf (bundled pdf.js) uses `import.meta`
  // in a way webpack cannot bundle ("Critical dependency" warning); mammoth goes with it.
  serverExternalPackages: ["pg-boss", "unpdf", "mammoth"],
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
