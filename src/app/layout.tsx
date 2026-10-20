import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "farma+ | Sistema de farmacia", description: "Panel de gestión para farmacia privada y asistencial." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
