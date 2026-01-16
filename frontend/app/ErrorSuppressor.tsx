'use client';

import { useEffect } from 'react';

/**
 * Suppresses noisy errors from browser extensions (wallet connectors, etc.)
 * that try to use chrome.runtime APIs from webpage context
 */
export function ErrorSuppressor() {
  useEffect(() => {
    // Suppress unhandled promise rejections from extensions
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      
      // Check if error is from chrome extension runtime
      if (
        reason?.message?.includes('chrome.runtime') ||
        reason?.message?.includes('Extension ID') ||
        reason?.stack?.includes('chrome-extension://')
      ) {
        // Silently prevent the error from showing in console
        event.preventDefault();
        return;
      }
    };

    // Suppress regular errors from extensions
    const handleError = (event: ErrorEvent) => {
      const error = event.error;
      const message = event.message;
      
      // Check if error is from chrome extension
      if (
        message?.includes('chrome.runtime') ||
        message?.includes('Extension ID') ||
        error?.stack?.includes('chrome-extension://') ||
        event.filename?.includes('chrome-extension://')
      ) {
        // Silently prevent the error from showing
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}
