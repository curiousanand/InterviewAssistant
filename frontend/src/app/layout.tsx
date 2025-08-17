import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ServiceProvider } from '@/lib/services/serviceContext';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Interview Assistant',
  description: 'Real-time multilingual Q&A assistant with voice input and AI-powered responses',
  keywords: ['interview', 'voice', 'AI', 'assistant', 'speech-to-text', 'real-time'],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ServiceProvider>
          <div className="relative flex min-h-screen flex-col">
            <div className="flex-1">
              {children}
            </div>
          </div>
        </ServiceProvider>
      </body>
    </html>
  );
}