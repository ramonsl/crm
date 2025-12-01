import type { Metadata } from "next";
import "./globals.css";
import AdminLayout from "@/components/AdminLayout";
import { ToastProvider } from "@/contexts/ToastContext";

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
          <AdminLayout>
            {children}
          </AdminLayout>
        </ToastProvider>
      </body>
    </html>
  );
}
