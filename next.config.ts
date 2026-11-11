import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      {
        source: "/privada/pos",
        destination: "/privada/punto-de-venta",
        permanent: true,
      },
      {
        source: "/privada/catalogo",
        destination: "/privada/productos",
        permanent: true,
      },
      {
        source: "/privada/inventario",
        destination: "/privada/stock-y-lotes",
        permanent: true,
      },
      {
        source: "/privada/ventas",
        destination: "/privada/historial",
        permanent: true,
      },
      {
        source: "/privada/indicadores",
        destination: "/privada/reportes",
        permanent: true,
      },
      {
        source: "/privada/usuarios",
        destination: "/privada/usuarios-y-roles",
        permanent: true,
      },
    ];
  },
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
