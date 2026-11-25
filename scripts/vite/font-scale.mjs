const SRC_CSS_PATTERN = /(^|[\\/])src[\\/].*\.css$/;
const COMMENT_SPLIT = /(\/\*[\s\S]*?\*\/)/g;
const FONT_SIZE_DECL = /(?<![\w-])(font-size\s*:\s*)(\d+(?:\.\d+)?)(px)(\s*(?:!important)?\s*(?=[;}]|$))/gi;
const FONT_SHORTHAND_DECL = /(?<![\w-])(font\s*:\s*)([^;{}]+)(?=[;}]|$)/gi;
const SHORTHAND_SIZE = /(^|\s)(\d+(?:\.\d+)?)px(?=[\s/])/;

function transformCodeChunk(chunk) {
  const withFontSize = chunk.replace(FONT_SIZE_DECL, (match, prefix, amount, unit, suffix) => {
    if (Number(amount) <= 0) return match;
    return `${prefix}calc(${amount}${unit} * var(--font-scale, 1))${suffix}`;
  });
  return withFontSize.replace(FONT_SHORTHAND_DECL, (match, prefix, value) => {
    if (/var\(--font-scale|calc\(/i.test(value)) return match;
    const replaced = value.replace(SHORTHAND_SIZE, (sizeMatch, lead, amount) => {
      if (Number(amount) <= 0) return sizeMatch;
      return `${lead}calc(${amount}px * var(--font-scale, 1))`;
    });
    return `${prefix}${replaced}`;
  });
}

export function transformFontScaleCss(source) {
  return source
    .split(COMMENT_SPLIT)
    .map((part, index) => (index % 2 === 1 ? part : transformCodeChunk(part)))
    .join("");
}

export function fontScaleCssPlugin() {
  return {
    name: "fuyu-font-scale-css",
    enforce: "pre",
    transform(code, id) {
      const cleanId = id.split("?")[0];
      if (!SRC_CSS_PATTERN.test(cleanId)) return null;
      const next = transformFontScaleCss(code);
      if (next === code) return null;
      return { code: next, map: null };
    },
  };
}
