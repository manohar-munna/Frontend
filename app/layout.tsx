import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iPhone 18 Pro — The next perspective",
  description: "An interactive concept experience for iPhone 18 Pro.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
