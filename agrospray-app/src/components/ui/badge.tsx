import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const badge = cva("inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide", {
  variants: {
    tone: {
      green: "bg-brand-bg text-brand-dark",
      coral: "bg-coral-bg text-coral-dark",
      orange: "bg-orange-bg text-[#b5631f]",
      grey: "bg-[#eef0ec] text-mut",
    },
  },
  defaultVariants: { tone: "grey" },
});

export function Badge({
  tone,
  className,
  children,
}: VariantProps<typeof badge> & { className?: string; children: ReactNode }) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>;
}
