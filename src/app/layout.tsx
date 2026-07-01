import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moviltravel Logistics Hub",
  description: "Gestion modular de servicios logisticos y traslados"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
