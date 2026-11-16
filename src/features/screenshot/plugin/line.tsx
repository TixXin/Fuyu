import { defineSlot } from "../../plugin-kernel/slots";

type LineContext = {
  screenshotPeek: string | null;
};

const lineSlot = defineSlot<LineContext>("island.line/v1");

function TextPeekLine({ screenshotPeek }: LineContext) {
  return screenshotPeek ? <span className="island__active-task" key={screenshotPeek}>{screenshotPeek}</span> : null;
}

lineSlot.add({ id: "screenshot.text", component: TextPeekLine });
