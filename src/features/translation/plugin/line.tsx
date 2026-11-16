import { defineSlot } from "../../plugin-kernel/slots";
import { OWNER } from "./owner.ts";

type LineContext = {
  translationPeek: string | null;
};

const lineSlot = defineSlot<LineContext>("island.line/v1");

function PeekLine({ translationPeek }: LineContext) {
  return translationPeek ? <span className="island__active-task" key={translationPeek}>{translationPeek}</span> : null;
}

lineSlot.add({ id: "translation.peek", component: PeekLine }, OWNER);
