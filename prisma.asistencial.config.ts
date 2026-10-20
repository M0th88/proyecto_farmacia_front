import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/asistencial/schema.prisma",

  migrations: {
    path: "prisma/asistencial/migrations",
  },

  datasource: {
    url: env("DATABASE_URL_ASISTENCIAL"),
  },
});