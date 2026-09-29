import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "pRash AI — all-in-one private chat",
  description:
    "Personal multi-agent AI chat with automatic model fallback, attachments, worksheets, reports and more.",
};

export const viewport: Viewport = {
  themeColor: "#0b0f19",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('prash-ai:theme');if(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)t='light';if(t==='light')document.documentElement.classList.add('light')}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
