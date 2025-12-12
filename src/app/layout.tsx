import type { Metadata } from "next";
import "./globals.css";
import ConditionalLayout from "@/components/ConditionalLayout";
import { ToastProvider } from "@/contexts/ToastContext";
import { StatusProvider } from "@/contexts/StatusContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { WhatsAppNotificationManager } from '@/components/WhatsAppNotificationManager';

export const metadata: Metadata = {
  title: "Coordena+",
  description: "Gerenciamento de Candidatos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ToastProvider>
          <StatusProvider>
            <SocketProvider>
              <WhatsAppNotificationManager />
              <ConditionalLayout>
                {children}
              </ConditionalLayout>
            </SocketProvider>
          </StatusProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
