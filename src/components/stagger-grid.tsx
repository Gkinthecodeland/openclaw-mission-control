"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StaggerGridProps {
  children: ReactNode[];
  className?: string;
  columns?: string;
}

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const item = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

export function StaggerGrid({
  children,
  className,
  columns = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
}: StaggerGridProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={cn("grid gap-4", columns, className)}
    >
      {children.map((child, i) => (
        <motion.div key={i} variants={item}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
