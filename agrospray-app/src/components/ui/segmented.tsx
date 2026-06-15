import { cn } from "@/lib/utils";

export interface SegOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  activeClass = "bg-brand text-white",
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  activeClass?: string;
}) {
  return (
    <span className="inline-flex gap-0.5 rounded-full border border-line bg-[#f3f5f1] p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-mut transition-colors",
            value === o.value && activeClass
          )}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}
