import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl2 border border-line bg-card p-4", className)} {...props} />;
}

export function KpiCard({
  label,
  value,
  foot,
  tone = "ink",
  right,
}: {
  label: string;
  value: string;
  foot?: string;
  tone?: "ink" | "green" | "coral" | "orange";
  right?: ReactNode;
}) {
  const toneCls = {
    ink: "text-ink",
    green: "text-brand-dark",
    coral: "text-coral-dark",
    orange: "text-[#b5631f]",
  }[tone];
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between">
        <span className="upper">{label}</span>
        {right}
      </div>
      <div className={cn("mt-2 text-[27px] font-bold tracking-tight", toneCls)}>{value}</div>
      {foot && <div className="mt-1 text-[11.5px] text-mut">{foot}</div>}
    </Card>
  );
}
