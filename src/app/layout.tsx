
import type {Metadata} from 'next';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { Toaster } from '@/components/ui/toaster';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'NeuroTrade Command | Sistemas de IA Cuántica',
  description: 'Centro de mando para trading de alta precisión impulsado por un ejército de IA.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary selection:text-white">
        {/* RECAPTCHA ENTERPRISE PROTECTION - LOADED BEFORE HYDRATION */}
        <Script 
          src="https://www.google.com/recaptcha/enterprise.js?render=6LcsviotAAAAAOjneBwLDB9feQMo-YVXrJUdNykl" 
          strategy="beforeInteractive" 
        />
        <FirebaseClientProvider>
          {children}
          <FirebaseErrorListener />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
