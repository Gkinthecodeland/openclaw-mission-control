"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { CrTabItem } from "@/lib/cr-types";

interface CrTabBarProps {
  tabs: CrTabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  layoutId?: string;
}

export function CrTabBar({ tabs, activeTab, onTabChange, layoutId = "tab-indicator" }: CrTabBarProps) {
  return (
    <div className="flex gap-1 rounded-xl bg-mc-bg-surface p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "relative rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200",
            activeTab === tab.id
              ? "text-mc-text-primary"
              : "text-mc-text-muted hover:text-mc-text-secondary"
          )}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 rounded-lg bg-mc-bg-hover"
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
