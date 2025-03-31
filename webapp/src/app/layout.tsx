import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Script from "next/script";
import ErrorBoundaryWrapper from "@/components/ErrorBoundaryWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DreamStream | Stylized livestreams using AI",
  description: "Create and share stylized livestreams powered by AI - perfect for events, parties and creative sharing",
  manifest: "/favicon/site.webmanifest",
  icons: {
    icon: [
      {
        url: '/favicon/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png'
      },
      {
        url: '/favicon/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png'
      },
      {
        url: '/favicon/favicon.ico',
        type: 'image/x-icon',
      }
    ],
    apple: {
      url: '/favicon/apple-touch-icon.png',
      type: 'image/png',
    },
    other: [
      {
        url: '/favicon/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/favicon/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Let Next.js metadata handle the manifest */}
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {/* Enhanced error handler script for both app and Stripe errors */}
        <Script id="error-handler" strategy="beforeInteractive">
          {`
            // Enhanced error suppression
            (function() {
              const originalError = console.error;
              console.error = function() {
                // Check if it's any of the known errors we want to suppress
                if (
                  // App errors
                  (arguments[0] && typeof arguments[0] === 'string' && (
                    arguments[0].includes('Permissions-Policy') ||
                    arguments[0].includes('Manifest') ||
                    arguments[0].includes('preload') ||
                    arguments[0].includes('as value')
                  )) || 
                  // Stripe errors
                  (arguments[0] && arguments[0].toString && arguments[0].toString().includes('FetchError')) ||
                  (arguments[0] && arguments[0].message && arguments[0].message.includes('Failed to fetch'))
                ) {
                  return; // Suppress the error
                }
                
                // Let other errors through
                return originalError.apply(console, arguments);
              };
              
              // Also suppress unhandled promise rejections
              window.addEventListener('unhandledrejection', function(event) {
                if (event.reason && 
                    ((typeof event.reason.message === 'string' && 
                     (event.reason.message.includes('Failed to fetch') || 
                      event.reason.message.includes('r.stripe.com'))) ||
                     (event.reason.toString && event.reason.toString().includes('FetchError'))
                    )
                ) {
                  event.preventDefault();
                }
              });
            })();
          `}
        </Script>
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <ErrorBoundaryWrapper>
              <main className="flex-grow">
                {children}
              </main>
            </ErrorBoundaryWrapper>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
