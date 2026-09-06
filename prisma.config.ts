import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Cargar .env explícitamente
config({ path: ".env", override: true });

// .env.local pisa a .env, igual que hace Next.js de fábrica. Sin esto, Prisma
// leería la base de producción mientras el dashboard apunta a la local — y esa
// desalineación no da error, simplemente corre las migraciones donde no va.
config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
