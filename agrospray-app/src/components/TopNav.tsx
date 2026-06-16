import { useSim } from "@/state/sim";
import { cn } from "@/lib/utils";

export type Tab = "command" | "field" | "briefing" | "business" | "fleet" | "playback";
const TABS: { id: Tab; label: string }[] = [
  { id: "command", label: "Command" },
  { id: "field", label: "Field Twin" },
  { id: "briefing", label: "AI Briefing" },
  { id: "business", label: "Cost saving" },
  { id: "fleet", label: "Fleet & Airspace" },
  { id: "playback", label: "Playback" },
];

export function TopNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { receiver, setReceiver } = useSim();
  return (
    <nav className="flex items-center gap-3 rounded-full border border-line bg-card px-3 py-2 shadow-soft">
      <div className="flex items-center gap-2 pl-1 text-[15px] font-bold">
        <span className="grid h-[26px] w-[26px] place-items-center rounded-[9px] bg-gradient-to-br from-orange to-brand text-[14px] font-extrabold text-white shadow">
          A
        </span>
        AgroSpray AI
      </div>
      <div className="mx-auto flex gap-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-[7px] text-[13px] font-semibold text-mut hover:text-ink",
              tab === t.id && "bg-orange-bg text-coral-dark"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-full border border-line bg-[#f3f5f1] p-[3px]">
        <button
          onClick={() => setReceiver("5m")}
          className={cn(
            "rounded-full px-3 py-[5px] text-[12px] font-semibold text-mut",
            receiver === "5m" && "bg-orange text-white"
          )}
        >
          5 m
        </button>
        <button
          onClick={() => setReceiver("1m")}
          className={cn(
            "rounded-full px-3 py-[5px] text-[12px] font-semibold text-mut",
            receiver === "1m" && "bg-brand text-white"
          )}
        >
          1 m
        </button>
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-[5px] text-[12px] font-semibold text-brand-dark">
        <span className="h-[7px] w-[7px] rounded-full bg-brand shadow-[0_0_0_3px_rgba(47,158,99,.18)]" />
        LIVE
      </div>
    </nav>
  );
}
