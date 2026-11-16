import { defineSlot } from "../../plugin-kernel/slots";
import { screenshotIsland } from "./islandState";

const lineSlot = defineSlot<object>("island.line/v1");

function TextPeekLine() {
  const { peek } = screenshotIsland.use();
  return peek ? <span className="island__active-task" key={peek}>{peek}</span> : null;
}

lineSlot.add({ id: "screenshot.text", component: TextPeekLine });
