import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Footer from '@/components/Footer';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'VS Code Chat Log Viewer',
  description:
    'View GitHub Copilot VS Code chat logs in a beautiful, VS Code-like interface',
  keywords: [
    'GitHub Copilot',
    'VS Code',
    'Chat Log',
    'Viewer',
    'Developer Tools',
  ],
  authors: [{ name: 'Harald Kirschner' }],
  creator: 'Harald Kirschner',
  openGraph: {
    title: 'VS Code Chat Log Viewer',
    description: 'View GitHub Copilot VS Code chat logs in a beautiful interface',
    type: 'website',
    locale: 'en_US',
    siteName: 'VS Code Chat Log Viewer',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VS Code Chat Log Viewer',
    description: 'View GitHub Copilot VS Code chat logs in a beautiful interface',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#1e1e1e' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Manifest for PWA */}
        <link rel="manifest" href="/manifest.json" />

        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://api.github.com" />
        <link rel="dns-prefetch" href="https://api.github.com" />
      </head>
      <body className={`${inter.className} antialiased`}>
        {/* Skip to main content for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-purple-600 focus:text-white"
        >
          Skip to main content
        </a>

        {/* Main content wrapper */}
        <main id="main-content" className="min-h-screen">
          {children}
        </main>

        {/* Global footer */}
        <Footer />

        {/* Analytics placeholder - uncomment and add your tracking ID */}
        {/* {process.env.NODE_ENV === 'production' && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
                `,
              }}
            />
          </>
        )} */}
      </body>
    </html>
  );
}
