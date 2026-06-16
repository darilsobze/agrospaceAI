import { useState } from "react";
import { Splash } from "./components/Splash";
import { TopNav, type Tab } from "./components/TopNav";
import { ScenarioBanner } from "./components/ScenarioBanner";
import { CommandCenter } from "./components/CommandCenter";
import { FieldTwin3D } from "./components/FieldTwin3D";
import { AIBriefing } from "./components/AIBriefing";
import { FollowVsIgnore } from "./components/FollowVsIgnore";
import { FleetAirspace } from "./components/FleetAirspace";
import { Playback } from "./components/Playback";
import { Transport } from "./components/Transport";

export default function App() {
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState<Tab>("command");
  if (!entered) return <Splash onEnter={() => setEntered(true)} />;
  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-16">
      <div className="sticky top-0 z-40 -mx-5 border-b border-line/60 bg-bg/90 px-5 pb-3 pt-[18px] backdrop-blur-sm">
        <TopNav tab={tab} setTab={setTab} />
        <ScenarioBanner />
      </div>
      <div className="pt-1">
        {tab === "command" && <CommandCenter setTab={setTab} />}
        {tab === "field" && <FieldTwin3D />}
        {tab === "briefing" && <AIBriefing />}
        {tab === "business" && <FollowVsIgnore />}
        {tab === "fleet" && <FleetAirspace />}
        {tab === "playback" && <Playback />}
      </div>
      <Transport />
    </div>
  );
}
