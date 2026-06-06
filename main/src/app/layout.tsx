import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dimsum Shadowing Game",
  description: "Dimsum Shadowing Game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
