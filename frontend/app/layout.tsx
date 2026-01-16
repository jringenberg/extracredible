import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Believeth',
  description: 'Stake on beliefs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script id="error-suppressor" strategy="beforeInteractive">
          {`
            // Suppress chrome extension errors before anything else loads
            (function() {
              const originalConsoleError = console.error;
              console.error = function(...args) {
                const message = args.join(' ');
                if (
                  message.includes('chrome.runtime') ||
                  message.includes('Extension ID') ||
                  message.includes('chrome-extension')
                ) {
                  return; // Silently ignore
                }
                originalConsoleError.apply(console, args);
              };

              window.addEventListener('error', function(event) {
                const message = event.message || '';
                const filename = event.filename || '';
                if (
                  message.includes('chrome.runtime') ||
                  message.includes('Extension ID') ||
                  filename.includes('chrome-extension')
                ) {
                  event.stopImmediatePropagation();
                  event.preventDefault();
                  return true;
                }
              }, true);

              window.addEventListener('unhandledrejection', function(event) {
                const reason = event.reason || {};
                const message = reason.message || reason.toString();
                if (
                  message.includes('chrome.runtime') ||
                  message.includes('Extension ID') ||
                  message.includes('chrome-extension')
                ) {
                  event.stopImmediatePropagation();
                  event.preventDefault();
                  return true;
                }
              }, true);
            })();
          `}
        </Script>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
