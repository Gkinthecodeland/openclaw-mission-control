import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Header, AgentChatPanel } from "@/components/header";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { ThemeProvider } from "@/components/theme-provider";
import { ChatNotificationToast } from "@/components/chat-notification-toast";
import { RestartAnnouncementBar } from "@/components/restart-announcement-bar";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mission Control — OpenClaw GUI Dashboard for Local AI Agents",
  description:
    "Mission Control is the open-source OpenClaw GUI and AI agent dashboard. " +
    "Monitor, chat with, and manage your local AI agents, models, cron jobs, " +
    "vector memory, and skills — all from a single local AI management tool " +
    "that runs entirely on your machine.",
  keywords: [
    "OpenClaw GUI",
    "AI agent dashboard",
    "local AI management tool",
    "OpenClaw dashboard",
    "AI agent manager",
    "local AI assistant",
    "OpenClaw Mission Control",
    "self-hosted AI dashboard",
    "AI agent monitoring",
    "open source AI GUI",
    "AI model management",
    "AI cron jobs",
    "vector memory dashboard",
    "LLM management tool",
    "private AI",
  ],
  manifest: "/manifest.json",
  applicationName: "Mission Control",
  authors: [{ name: "OpenClaw" }],
  creator: "OpenClaw",
  publisher: "OpenClaw",
  category: "technology",
  openGraph: {
    type: "website",
    siteName: "Mission Control — OpenClaw GUI",
    title: "Mission Control — The AI Agent Dashboard for OpenClaw",
    description:
      "Monitor, chat with, and manage your local AI agents from one sleek dashboard. " +
      "Open-source, self-hosted, zero cloud. The ultimate OpenClaw GUI.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mission Control — OpenClaw GUI & AI Agent Dashboard",
    description:
      "Open-source local AI management tool. Monitor agents, models, cron jobs, " +
      "vector memory and more — entirely on your machine.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mission Control",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  var token = new URLSearchParams(window.location.search).get("token");
  if (token) sessionStorage.setItem("mc-auth-token", token);
  token = token || sessionStorage.getItem("mc-auth-token");
  if (!token) return;

  // Patch fetch — runs BEFORE React hydration
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === "string" ? input : (input instanceof URL ? input.href : (input instanceof Request ? input.url : ""));
    if (url.indexOf("/api/") === 0 || url.indexOf(window.location.origin + "/api/") === 0) {
      init = init || {};
      var h = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      if (!h.has("Authorization")) h.set("Authorization", "Bearer " + token);
      init.headers = h;
      return origFetch.call(this, input, init);
    }
    return origFetch.call(this, input, init);
  };

  // Patch EventSource — can't set headers, append token as query param
  if (window.EventSource) {
    var OrigES = window.EventSource;
    window.EventSource = function(url, opts) {
      var u = typeof url === "string" ? url : url.href;
      if (u.indexOf("/api/") !== -1) u += (u.indexOf("?") !== -1 ? "&" : "?") + "token=" + token;
      return new OrigES(u, opts);
    };
    window.EventSource.prototype = OrigES.prototype;
    window.EventSource.CONNECTING = OrigES.CONNECTING;
    window.EventSource.OPEN = OrigES.OPEN;
    window.EventSource.CLOSED = OrigES.CLOSED;
  }

  // Patch WebSocket — append token as query param
  var OrigWS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    var u = typeof url === "string" ? url : url.href;
    if (u.indexOf("/api/") !== -1) u += (u.indexOf("?") !== -1 ? "&" : "?") + "token=" + token;
    return new OrigWS(u, protocols);
  };
  window.WebSocket.prototype = OrigWS.prototype;
  window.WebSocket.CONNECTING = OrigWS.CONNECTING;
  window.WebSocket.OPEN = OrigWS.OPEN;
  window.WebSocket.CLOSING = OrigWS.CLOSING;
  window.WebSocket.CLOSED = OrigWS.CLOSED;
})();
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-mono antialiased`}
      >
        <ThemeProvider>
          <KeyboardShortcuts />
          <div className="flex h-screen overflow-hidden">
            <Suspense><Sidebar /></Suspense>
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Header />
              <RestartAnnouncementBar />
              <main className="flex flex-1 overflow-hidden">
                <Suspense>{children}</Suspense>
              </main>
            </div>
          </div>
          <AgentChatPanel />
          <ChatNotificationToast />
        </ThemeProvider>
      </body>
    </html>
  );
}
