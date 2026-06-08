import type { Metadata } from 'next';
import './globals.css';

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
      </body>
    </html>
  );
}
