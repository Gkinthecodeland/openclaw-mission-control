import { NextResponse } from "next/server";
import type { CrEcosystemProduct } from "@/lib/cr-types";

const PRODUCTS: Record<string, CrEcosystemProduct> = {
  openclaw: {
    slug: "openclaw", name: "OpenClaw", tagline: "Agent framework for AI autonomy", icon: "Brain", color: "#00d4ff", status: "active",
    techStack: ["Node.js", "TypeScript", "SQLite"], links: { github: "https://github.com/gk/openclaw" }, metrics: { agents: 2, tasks: 147, uptime: "99.9%" },
  },
  "donna-ai": {
    slug: "donna-ai", name: "Donna AI", tagline: "24/7 AI assistant on Mac Studio", icon: "Bot", color: "#a855f7", status: "active",
    techStack: ["OpenClaw", "Haiku 4.5", "Telegram", "Discord"], links: {}, metrics: { messages: 1240, tasks: 89, uptime: "99.7%" },
  },
  "factory-os": {
    slug: "factory-os", name: "Factory OS", tagline: "Manufacturing brain for Achaiki Pita", icon: "Factory", color: "#f59e0b", status: "active",
    techStack: ["Electron", "React", "SQLite", "Claude"], links: {}, metrics: { batches: 420, sprints: 7, uptime: "100%" },
  },
  "mission-control": {
    slug: "mission-control", name: "Mission Control", tagline: "Visual command center for OpenClaw", icon: "Monitor", color: "#06b6d4", status: "development",
    techStack: ["Next.js", "Convex", "Tailwind"], links: {}, metrics: { pages: 8, components: 12 },
  },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const product = PRODUCTS[slug];

  if (!product) {
    return NextResponse.json(
      { data: null, error: "Product not found", timestamp: new Date().toISOString() },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: { product },
    timestamp: new Date().toISOString(),
  });
}
