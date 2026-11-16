import { defineSlot } from "../../plugin-kernel/slots";
import { translationPeekState } from "./islandState";
import { OWNER } from "./owner.ts";

const lineSlot = defineSlot<object>("island.line/v1");

function PeekLine() {
  const peek = translationPeekState.use();
  return peek ? <span className="island__active-task" key={peek}>{peek}</span> : null;
}

lineSlot.add({ id: "translation.peek", component: PeekLine }, OWNER);
