import { NextResponse } from "next/server";
import type { CrEcosystemProduct } from "@/lib/cr-types";

const fallback: CrEcosystemProduct[] = [
  { slug: "openclaw", name: "OpenClaw", tagline: "Agent framework for AI autonomy", icon: "Brain", color: "#00d4ff", status: "active", techStack: ["Node.js", "TypeScript", "SQLite"] },
  { slug: "donna-ai", name: "Donna AI", tagline: "24/7 AI assistant on Mac Studio", icon: "Bot", color: "#a855f7", status: "active", techStack: ["OpenClaw", "Haiku 4.5", "Telegram", "Discord"] },
  { slug: "factory-os", name: "Factory OS", tagline: "Manufacturing brain for Achaiki Pita", icon: "Factory", color: "#f59e0b", status: "active", techStack: ["Electron", "React", "SQLite", "Claude"] },
  { slug: "mission-control", name: "Mission Control", tagline: "Visual command center for OpenClaw", icon: "Monitor", color: "#06b6d4", status: "development", techStack: ["Next.js", "Convex", "Tailwind"] },
];

export async function GET() {
  return NextResponse.json({
    data: { products: fallback },
    timestamp: new Date().toISOString(),
  });
}
