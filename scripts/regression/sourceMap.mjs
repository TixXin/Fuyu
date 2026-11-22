const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const DIGIT = new Map([...BASE64].map((char, index) => [char, index]));

export function decodeVlq(text) {
  const values = [];
  let value = 0;
  let shift = 0;
  for (const char of text) {
    const digit = DIGIT.get(char);
    if (digit === undefined) throw new Error(`Bad VLQ character ${char}`);
    value += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
      continue;
    }
    values.push(value & 1 ? -(value >>> 1) : value >>> 1);
    value = 0;
    shift = 0;
  }
  return values;
}

export function decodeMappings(mappings) {
  const lines = [];
  let source = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  for (const text of mappings.split(";")) {
    const segments = [];
    let column = 0;
    if (text) {
      for (const part of text.split(",")) {
        if (!part) continue;
        const fields = decodeVlq(part);
        column += fields[0];
        if (fields.length < 4) continue;
        source += fields[1];
        sourceLine += fields[2];
        sourceColumn += fields[3];
        segments.push([column, source, sourceLine]);
      }
    }
    lines.push(segments);
  }
  return lines;
}

export function lineStarts(code) {
  const starts = [0];
  for (let index = 0; index < code.length; index++) if (code.charCodeAt(index) === 10) starts.push(index + 1);
  return starts;
}

export function mappedOffsets(code, map, sourceIndex = 0) {
  const starts = lineStarts(code);
  const out = [];
  decodeMappings(map.mappings ?? "").forEach((segments, line) => {
    if (line >= starts.length) return;
    for (const [column, source, sourceLine] of segments) {
      if (source === sourceIndex) out.push([starts[line] + column, sourceLine + 1]);
    }
  });
  return out.sort((a, b) => a[0] - b[0]);
}
