import "./globals.css";
import SessionProvider from "@/components/SessionProvider";

export const metadata = {
  title: "FieldFlow — Farm Contracting Management",
  description: "Manage jobs, logging, and invoicing for agricultural contracting",
  manifest: "/manifest.json",
  themeColor: "#245a1e",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FieldFlow",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FieldFlow" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-stone-50 text-stone-900 antialiased">
        <SessionProvider>{children}</SessionProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('SW registered:', reg.scope))
                    .catch(err => console.log('SW registration failed:', err));
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
