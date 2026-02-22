import { NextResponse } from "next/server";
import type { CrContact } from "@/lib/cr-types";

const fallback: CrContact[] = [
  { id: "1", name: "Metro AG", company: "Metro", type: "client", stage: "won", value: 45000, tags: ["wholesale"] },
  { id: "2", name: "Lidl Hellas", company: "Lidl", type: "lead", stage: "contacted", value: 120000, tags: ["retail", "national"] },
  { id: "3", name: "AB Vassilopoulos", company: "AB", type: "lead", stage: "prospect", value: 80000, tags: ["retail"] },
  { id: "4", name: "Masoutis", company: "Masoutis", type: "lead", stage: "negotiation", value: 65000, tags: ["retail", "northern-greece"] },
];

export async function GET() {
  return NextResponse.json({
    data: { contacts: fallback },
    timestamp: new Date().toISOString(),
  });
}
