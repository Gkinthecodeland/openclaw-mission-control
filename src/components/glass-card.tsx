"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className, hover = false, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "glass rounded-xl p-4",
        hover && "cursor-pointer transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.1]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}
