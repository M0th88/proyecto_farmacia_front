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
        destination: "/privada/productos-y-empaques",
        permanent: true,
      },
      {
        source: "/privada/productos",
        destination: "/privada/productos-y-empaques",
        permanent: true,
      },
      {
        source: "/privada/inventario",
        destination: "/privada/stocks-y-lotes",
        permanent: true,
      },
      {
        source: "/privada/stock-y-lotes/:path*",
        destination: "/privada/stocks-y-lotes/:path*",
        permanent: true,
      },
      {
        source: "/privada/ventas",
        destination: "/privada/historial-y-reportes",
        permanent: true,
      },
      {
        source: "/privada/indicadores",
        destination: "/privada/historial-y-reportes",
        permanent: true,
      },
      {
        source: "/privada/historial",
        destination: "/privada/historial-y-reportes",
        permanent: true,
      },
      {
        source: "/privada/reportes",
        destination: "/privada/historial-y-reportes",
        permanent: true,
      },
      {
        source: "/privada/caja",
        destination: "/privada/caja-del-dia",
        permanent: true,
      },
      {
        source: "/privada/usuarios-y-roles/:path*",
        destination: "/privada/usuarios/:path*",
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
