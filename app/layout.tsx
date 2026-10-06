import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Хелпер — решебник школьных задач",
  description: "Сфотографируй задачу — получи пошаговое решение. Мини-приложение в Telegram.",
  applicationName: "Хелпер",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "transparent",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="ru">
      <head>
        {/*
          Injected by @tma.js/sdk in dev when mockTelegramEnv is used, or by Telegram
          in production. We don't need extra <script> tags — the SDK reads the URL.
        */}
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
