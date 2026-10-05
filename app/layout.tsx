import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Planner",
  description: "Classes, exams and assignments in one calm view — with focus timers that sync everywhere.",
  applicationName: "Planner",
  appleWebApp: {
    capable: true,
    title: "Planner",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#151515",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-app">{children}</body>
    </html>
  );
}
