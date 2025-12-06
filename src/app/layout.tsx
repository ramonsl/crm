import type { Metadata } from "next";
import "./globals.css";
import AdminLayout from "@/components/AdminLayout";
import { ToastProvider } from "@/contexts/ToastContext";
import { StatusProvider } from "@/contexts/StatusContext";

export const metadata: Metadata = {
  title: "ADS CRM",
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
            <AdminLayout>
              {children}
            </AdminLayout>
          </StatusProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
