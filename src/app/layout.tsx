import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://loyalty.iagodigital.com"),
  title: {
    default: "iAGO Loyalty",
    template: "%s · iAGO Loyalty",
  },
  description: "Multi-tenant loyalty programs for independent businesses, by iAGO Digital.",
  icons: {
    icon: [
      { url: "/brand/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico", sizes: "256x256" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
