import { useState } from "react";
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
  const [tab, setTab] = useState<Tab>("command");
  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-16 pt-[18px]">
      <TopNav tab={tab} setTab={setTab} />
      <ScenarioBanner />
      {tab === "command" && <CommandCenter setTab={setTab} />}
      {tab === "field" && <FieldTwin3D />}
      {tab === "briefing" && <AIBriefing />}
      {tab === "business" && <FollowVsIgnore />}
      {tab === "fleet" && <FleetAirspace />}
      {tab === "playback" && <Playback />}
      <Transport />
    </div>
  );
}
