
import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DuesFlow | Enterprise Supplier Dues Management',
  description: 'Smart Accounts Payable dashboard with FIFO payment handling and Tally integration.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-[#F3F6F9]">{children}</body>
    </html>
  );
}
