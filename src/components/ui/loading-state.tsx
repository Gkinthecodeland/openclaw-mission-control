"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClass: Record<NonNullable<LoadingStateProps["size"]>, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4.5 w-4.5",
  lg: "h-6 w-6",
};

export function InlineSpinner({
  className,
  size = "sm",
}: {
  className?: string;
  size?: LoadingStateProps["size"];
}) {
  return (
    <Loader2
      className={cn(
        "animate-spin text-muted-foreground/70",
        sizeClass[size || "sm"],
        className
      )}
    />
  );
}

export function LoadingState({
  label = "Loading...",
  className,
  size = "md",
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground/70",
        className
      )}
    >
      <InlineSpinner size={size} />
      <span>{label}</span>
    </div>
  );
}

