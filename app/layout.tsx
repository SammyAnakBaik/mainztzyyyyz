import type { Metadata } from "next";
import "./globals.css";
import { VoamProvider } from "@/context/VoamContext";
import DynamicIsland from "@/components/ui/DynamicIsland";

export const metadata: Metadata = {
  title: "MainZ Voam — SaaS Cloud Deployment & In-Browser Monaco IDE",
  description:
    "Platform SaaS Deployment berbasis Vercel REST API v13 dan In-Browser IDE berbasis Monaco Editor & Firebase Firestore.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-voam-bg bg-voam-mesh text-voam-text selection:bg-voam-neon/30 selection:text-voam-neon">
        <VoamProvider>
          <DynamicIsland />
          {children}
        </VoamProvider>
      </body>
    </html>
  );
}
