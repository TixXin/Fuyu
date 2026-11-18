export type OutlineEdge = "top" | "bottom" | "left" | "right";

type Point = readonly [string, string];
type Segment =
  | { kind: "move" | "line"; to: Point }
  | { kind: "arc"; to: Point; radius: string }
  | { kind: "curve"; to: Point; c1: Point; c2: Point };

type Corners = { near: string; far: string };

const FILLET = "var(--island-top-fillet)";
const K = "var(--island-corner-k, 0.5523)";
const RIM = "var(--island-rim-width, 1px)";

const CORNERS: Record<OutlineEdge, Corners> = {
  top: { near: "var(--island-shell-top-corner)", far: "var(--island-shell-bottom-corner)" },
  bottom: { near: "var(--island-shell-bottom-corner)", far: "var(--island-shell-top-corner)" },
  left: { near: "0px", far: "var(--island-side-radius)" },
  right: { near: "0px", far: "var(--island-side-radius)" },
};

const calc = (expression: string) => `calc(${expression})`;

function contour(corners: Corners, f: string, w: string, docked: boolean): Segment[] {
  const rt = corners.near;
  const rb = corners.far;
  const wa = docked ? w : "0px";
  const wna = docked ? "0px" : w;
  const yT = docked ? `-1 * ${w}` : w;
  const L = f;
  const R = `100% - ${f}`;
  const trX0 = `${R} - ${rt} - ${wa}`;
  const trY0 = `${f} + ${wna}`;
  const trX3 = `${R} - ${w}`;
  const trY3 = `${f} + ${rt}`;
  const tlX0 = `${L} + ${w}`;
  const tlX3 = `${L} + ${rt} + ${wa}`;
  const bend = `${K} * (${rb} - ${w})`;
  return [
    { kind: "move", to: [rt, yT] },
    { kind: "line", to: [`100% - ${rt}`, yT] },
    { kind: "arc", to: [trX0, trY0], radius: `${f} + ${wa}` },
    {
      kind: "curve",
      to: [trX3, trY3],
      c1: [`${trX0} + ${K} * (${rt} + ${wa} - ${w})`, trY0],
      c2: [trX3, `${trY3} + ${K} * (${wna} - ${rt})`],
    },
    { kind: "line", to: [trX3, `100% - ${rb}`] },
    {
      kind: "curve",
      to: [`${R} - ${rb}`, `100% - ${w}`],
      c1: [trX3, `100% - ${rb} + ${bend}`],
      c2: [`${R} - ${rb} + ${bend}`, `100% - ${w}`],
    },
    { kind: "line", to: [`${L} + ${rb}`, `100% - ${w}`] },
    {
      kind: "curve",
      to: [tlX0, `100% - ${rb}`],
      c1: [`${L} + ${rb} - ${bend}`, `100% - ${w}`],
      c2: [tlX0, `100% - ${rb} + ${bend}`],
    },
    { kind: "line", to: [tlX0, trY3] },
    {
      kind: "curve",
      to: [tlX3, trY0],
      c1: [tlX0, `${trY3} + ${K} * (${wna} - ${rt})`],
      c2: [`${tlX3} - ${K} * (${rt} + ${wa} - ${w})`, trY0],
    },
    { kind: "arc", to: [rt, yT], radius: `${f} + ${wa}` },
  ];
}

function fillets(): Segment[] {
  const R = `100% - ${FILLET}`;
  return [
    { kind: "move", to: [FILLET, FILLET] },
    { kind: "arc", to: ["0px", "0px"], radius: FILLET },
    { kind: "line", to: [FILLET, "0px"] },
    { kind: "move", to: ["100%", "0px"] },
    { kind: "arc", to: [R, FILLET], radius: FILLET },
    { kind: "line", to: [R, "0px"] },
  ];
}

function shiftX(segments: Segment[], widen: string, offset: string): Segment[] {
  const shift = ([x, y]: Point): Point => [`(${x.split("100%").join(`(100% ${widen} 2 * ${FILLET})`)}) ${offset} ${FILLET}`, y];
  return segments.map((segment) =>
    segment.kind === "curve"
      ? { ...segment, to: shift(segment.to), c1: shift(segment.c1), c2: shift(segment.c2) }
      : { ...segment, to: shift(segment.to) },
  );
}

const toIslandBox = (segments: Segment[]) => shiftX(segments, "+", "-");
const toFilletBox = (segments: Segment[]) => shiftX(segments, "-", "+");

function place(edge: OutlineEdge, [x, y]: Point): Point {
  if (edge === "bottom") return [x, `100% - (${y})`];
  if (edge === "left") return [y, x];
  if (edge === "right") return [`100% - (${y})`, x];
  return [x, y];
}

function render(edge: OutlineEdge, segments: Segment[]): string {
  const sweep = edge === "bottom" || edge === "left" ? "cw" : "ccw";
  const at = (point: Point) => place(edge, point).map(calc).join(" ");
  const parts: string[] = [];
  for (const segment of segments) {
    if (segment.kind === "arc") parts.push(`arc to ${at(segment.to)} of ${calc(segment.radius)} ${sweep}`);
    else if (segment.kind === "curve") parts.push(`curve to ${at(segment.to)} with ${at(segment.c1)} / ${at(segment.c2)}`);
    else if (segment.kind === "line") parts.push(`line to ${at(segment.to)}`);
    else {
      if (parts.length > 0) parts.push("close");
      parts.push(`${parts.length === 0 ? "from" : "move to"} ${at(segment.to)}`);
    }
  }
  parts.push("close");
  return parts.join(", ");
}

function ring(edge: OutlineEdge, docked: boolean): string {
  const corners = docked ? CORNERS[edge] : CORNERS.top;
  const path = (w: string) => (docked ? contour(corners, FILLET, w, true) : toFilletBox(contour(corners, "0px", w, false)));
  const outer = render(edge, path("0px"));
  const inner = render(edge, path(RIM)).replace(/^from /, "move to ");
  return `shape(evenodd ${outer}, ${inner})`;
}

const EDGES: OutlineEdge[] = ["top", "bottom", "left", "right"];

export const ISLAND_OUTLINE_STYLE: Record<string, string> = Object.fromEntries([
  ...EDGES.map((edge) => [`--island-outline-fillets-${edge}`, `shape(nonzero ${render(edge, fillets())})`]),
  ...EDGES.map((edge) => [`--island-outline-rim-${edge}`, ring(edge, true)]),
  ...EDGES.map((edge) => [`--island-outline-body-${edge}`, `shape(nonzero ${render(edge, toIslandBox(contour(CORNERS[edge], FILLET, "0px", true)))})`]),
  ["--island-outline-rim-free", ring("top", false)],
]);
