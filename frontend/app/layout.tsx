import type { Metadata } from 'next';
import './globals.css';
import './styles.css';
import { Providers } from './providers';
import Script from 'next/script';

export const metadata: Metadata = {
  metadataBase: new URL('https://extracredible.xyz'),
  title: 'Extracredible',
  description: 'Stake on beliefs',
  icons: {
    icon: {
      url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text x='50' y='75' text-anchor='middle' font-size='80' font-family='serif' fill='%23000'>$</text></svg>",
      type: 'image/svg+xml',
    },
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
                  message.includes('chrome-extension') ||
                  (message.includes('Each child in a list') && message.includes('key'))
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
