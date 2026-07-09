import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#080810',
};

export const metadata: Metadata = {
  title: 'HostelMate',
  description: 'Smart hostel management by Nivo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className="antialiased"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
      >
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
