import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/privada/schema.prisma",

  migrations: {
    path: "prisma/privada/migrations",
  },

  datasource: {
    url: env("DATABASE_URL_PRIVADA"),
  },
});