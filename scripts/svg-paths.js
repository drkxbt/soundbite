// Flattens SVG markup into the paths the editor paints with Path2D. A picture drawn through an <img> can taint the
// canvas it lands on, so every icon becomes plain path data, with its own colours, when the app is built.

/** Thrown for an icon that uses something a flat list of paths can't hold; `reason` names that thing. */
export class Unsupported extends Error {
  constructor(reason) {
    super(`Unsupported SVG: ${reason}`);
    this.reason = reason;
  }
}

/** An SVG document as a drawing: its viewBox (or width and height) as `w` and `h`, and a path for every shape in it. */
export function svgToArt(svg) {
  const root = parse(svg).find((node) => node.name === "svg");
  if (!root) throw new Unsupported("no <svg>");
  const box = frame(root);
  const paths = [];
  group(root, { ...INITIAL, opacity: 1 }, [1, 0, 0, 1, -box.x, -box.y], paths);
  return { w: box.w, h: box.h, paths };
}

/**
 * Path data moved by an SVG matrix [a, b, c, d, e, f] and rounded to two decimals. A relative command keeps being
 * relative, but each step is measured from where the rounded path already stands, so rounding never adds up along it.
 */
export function pathData(d, matrix = IDENTITY) {
  const [a, b, c, dd, e, f] = matrix;
  const straight = b === 0 && c === 0;
  const place = (x, y) => [round(a * x + c * y + e), round(b * x + dd * y + f)];
  const read = reader(d);
  const out = writer();
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let letter = read.command();
  if (letter !== "M" && letter !== "m") throw new Unsupported("path data");
  while (letter) {
    let upper = letter.toUpperCase();
    const relative = letter !== upper;
    const abs = (dx, dy) => (relative ? [x + dx, y + dy] : [dx, dy]);
    if (upper === "Z") {
      out.close(letter);
      x = startX;
      y = startY;
      letter = read.command();
      continue;
    }
    do {
      if (upper === "H" || upper === "V") {
        const value = read.number();
        if (upper === "H") x = relative ? x + value : value;
        else y = relative ? y + value : value;
        // A turn or a slant leaves a level line no longer level, so it is written as a plain line.
        if (straight) out.axis(letter, place(x, y));
        else out.points(relative ? "l" : "L", [place(x, y)]);
      } else if (upper === "A") {
        const [rx, ry, angle] = [read.number(), read.number(), read.number()];
        const [large, sweep] = [read.flag(), read.flag()];
        [x, y] = abs(read.number(), read.number());
        out.arc(letter, arc(rx, ry, angle, sweep, matrix), large, place(x, y));
      } else {
        const count = { M: 1, L: 1, T: 1, S: 2, Q: 2, C: 3 }[upper];
        if (!count) throw new Unsupported("path data");
        const points = [];
        for (let i = 0; i < count; i++) points.push(abs(read.number(), read.number()));
        [x, y] = points[count - 1];
        out.points(letter, points.map(([px, py]) => place(px, py)));
        if (upper === "M") {
          [startX, startY] = [x, y];
          // Pairs after a move are lines, as SVG reads them.
          upper = "L";
          letter = relative ? "l" : "L";
        }
      }
    } while (read.more());
    letter = read.command();
  }
  return out.text();
}

const IDENTITY = [1, 0, 0, 1, 0, 0];
// SVG's own defaults for the properties a shape takes from the groups around it.
const INITIAL = { fill: "#000", stroke: "none", "stroke-width": "1", "fill-rule": "nonzero", "fill-opacity": "1", "stroke-opacity": "1" };
const INHERITED = Object.keys(INITIAL);
// Drawn only through a reference to them, and every such reference is refused, so they are passed over.
const UNDRAWN = new Set(["defs", "title", "desc", "metadata", "symbol", "linearGradient", "radialGradient", "clipPath", "mask", "filter", "pattern", "marker"]);
const REFERENCES = { "clip-path": "clip path", mask: "mask", filter: "filter" };

const SHAPES = {
  path: (at) => at.d ?? "",
  circle: (at) => ellipse(number(at.cx), number(at.cy), number(at.r), number(at.r)),
  ellipse: (at) => ellipse(number(at.cx), number(at.cy), number(at.rx ?? at.ry), number(at.ry ?? at.rx)),
  rect,
  line: (at) => `M${number(at.x1)} ${number(at.y1)}L${number(at.x2)} ${number(at.y2)}`,
  polyline: (at) => polyline(at.points, false),
  polygon: (at) => polyline(at.points, true),
};

function group(node, inherited, matrix, paths) {
  if (UNDRAWN.has(node.name)) return;
  if (node.name === "use") throw new Unsupported("use");
  const own = { ...node.attrs, ...declarations(node.attrs.style) };
  if (own.display === "none") return;
  for (const [name, reason] of Object.entries(REFERENCES)) {
    if (own[name] && own[name] !== "none") throw new Unsupported(reason);
  }
  // Opacity is folded into each shape's colours: exact for one shape, and close for a group whose shapes don't overlap.
  const style = { ...inherited, opacity: inherited.opacity * Math.min(Math.max(number(own.opacity ?? "1"), 0), 1) };
  for (const key of INHERITED) if (own[key] !== undefined && own[key] !== "inherit") style[key] = own[key].trim();
  const at = own.transform ? multiply(matrix, transform(own.transform)) : matrix;
  if (node.name === "svg" || node.name === "g") {
    for (const child of node.children) {
      if (child.name === "svg") throw new Unsupported("nested <svg>");
      group(child, style, at, paths);
    }
    return;
  }
  const shape = SHAPES[node.name];
  if (!shape) throw new Unsupported(`<${node.name}>`);
  const d = shape(own);
  if (!d.trim()) return;
  const part = paint(style, at, node.name !== "line");
  if (part) paths.push({ d: pathData(d, at), ...part });
}

function paint(style, matrix, fillable) {
  const fill = fillable ? colour(style.fill, style.opacity * number(style["fill-opacity"])) : null;
  let stroke = colour(style.stroke, style.opacity * number(style["stroke-opacity"]));
  const [a, b, c, d] = matrix;
  const scale = Math.sqrt(Math.abs(a * d - b * c));
  const width = round(number(style["stroke-width"]) * scale);
  if (width <= 0) stroke = null;
  // A line stretched more one way than the other would need a width that changes along it.
  if (stroke && (Math.abs(a * a + b * b - c * c - d * d) > 1e-6 || Math.abs(a * c + b * d) > 1e-6)) {
    throw new Unsupported("transform");
  }
  if (!fill && !stroke) return null;
  const part = {};
  if (fill) part.fill = fill;
  if (stroke) part.stroke = stroke;
  if (stroke && width !== 1) part.width = width;
  if (fill && style["fill-rule"] === "evenodd") part.rule = "evenodd";
  return part;
}

function colour(value, alpha) {
  if (!value || value === "none" || alpha <= 0) return null;
  if (value.startsWith("url(")) throw new Unsupported("gradient");
  const plain = value.toLowerCase() === "currentcolor" ? "currentColor" : value;
  if (alpha >= 1) return plain;
  const rgb = toRgb(plain);
  // The layer's colour is only known when it is drawn, so currentColor can't carry a fade of its own.
  if (!rgb) throw new Unsupported("opacity");
  return `rgba(${rgb.slice(0, 3).join(",")},${round(alpha * rgb[3], 3)})`;
}

const NAMED = { black: "#000", white: "#fff", red: "#f00", lime: "#0f0", blue: "#00f" };

function toRgb(value) {
  const css = NAMED[value.toLowerCase()] ?? value.toLowerCase();
  const short = css.match(/^#([\da-f])([\da-f])([\da-f])([\da-f])?$/);
  if (short) return [...short.slice(1, 4).map((digit) => parseInt(digit + digit, 16)), short[4] ? parseInt(short[4] + short[4], 16) / 255 : 1];
  const long = css.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})?$/);
  if (long) return [...long.slice(1, 4).map((pair) => parseInt(pair, 16)), long[4] ? parseInt(long[4], 16) / 255 : 1];
  const rgb = css.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/);
  if (rgb) return [...rgb.slice(1, 4).map(Number), rgb[4] === undefined ? 1 : Number(rgb[4])];
  return null;
}

function ellipse(cx, cy, rx, ry) {
  if (!(rx > 0 && ry > 0)) return "";
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
}

function rect(at) {
  const [x, y, w, h] = [number(at.x), number(at.y), number(at.width), number(at.height)];
  if (!(w > 0 && h > 0)) return "";
  // One radius given serves both ways, and no corner reaches past half a side.
  const rx = Math.min(Math.max(number(at.rx ?? at.ry), 0), w / 2);
  const ry = Math.min(Math.max(number(at.ry ?? at.rx), 0), h / 2);
  if (!rx || !ry) return `M${x} ${y}h${w}v${h}h${-w}z`;
  const corner = (dx, dy) => `a${rx} ${ry} 0 0 1 ${dx} ${dy}`;
  return `M${x + rx} ${y}h${w - 2 * rx}${corner(rx, ry)}v${h - 2 * ry}${corner(-rx, ry)}h${2 * rx - w}${corner(-rx, -ry)}v${2 * ry - h}${corner(rx, -ry)}z`;
}

function polyline(list = "", closed) {
  const values = list.trim().split(/[\s,]+/).map(Number);
  if (values.length < 4 || values.some(Number.isNaN)) return "";
  const pairs = [];
  for (let i = 0; i + 1 < values.length; i += 2) pairs.push(`${values[i]} ${values[i + 1]}`);
  return `M${pairs.join("L")}${closed ? "z" : ""}`;
}

/**
 * An arc's radii, turn and sweep after the matrix. The ellipse's axes become the columns of L * R(angle) * diag(rx, ry);
 * the new radii are that matrix's singular values and the new turn is the direction of the larger one.
 */
function arc(rx, ry, angle, sweep, [a, b, c, d]) {
  const flipped = a * d - b * c < 0 ? 1 - sweep : sweep;
  if (b === 0 && c === 0 && angle === 0) return [rx * Math.abs(a), ry * Math.abs(d), 0, flipped];
  const turn = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  const [m11, m21] = [(a * cos + c * sin) * rx, (b * cos + d * sin) * rx];
  const [m12, m22] = [(c * cos - a * sin) * ry, (d * cos - b * sin) * ry];
  const [p, q, r] = [m11 * m11 + m12 * m12, m11 * m21 + m12 * m22, m21 * m21 + m22 * m22];
  const [mid, spread] = [(p + r) / 2, Math.hypot((p - r) / 2, q)];
  return [Math.sqrt(mid + spread), Math.sqrt(Math.max(mid - spread, 0)), (Math.atan2(2 * q, p - r) * 90) / Math.PI, flipped];
}

/** An SVG transform list as one matrix [a, b, c, d, e, f]. */
function transform(list) {
  let matrix = IDENTITY;
  for (const [, name, args] of list.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = args.trim().split(/[\s,]+/).map(Number);
    if (v.some(Number.isNaN)) throw new Unsupported("transform");
    let step;
    if (name === "matrix" && v.length === 6) step = v;
    else if (name === "translate") step = [1, 0, 0, 1, v[0], v[1] ?? 0];
    else if (name === "scale") step = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (name === "rotate") {
      const turn = (v[0] * Math.PI) / 180;
      const [cos, sin, cx, cy] = [Math.cos(turn), Math.sin(turn), v[1] ?? 0, v[2] ?? 0];
      step = [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
    } else if (name === "skewX") step = [1, 0, Math.tan((v[0] * Math.PI) / 180), 1, 0, 0];
    else if (name === "skewY") step = [1, Math.tan((v[0] * Math.PI) / 180), 0, 1, 0, 0];
    else throw new Unsupported("transform");
    matrix = multiply(matrix, step);
  }
  return matrix;
}

function multiply([a1, b1, c1, d1, e1, f1], [a2, b2, c2, d2, e2, f2]) {
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
}

function frame(svg) {
  const box = (svg.attrs.viewBox ?? "").trim().split(/[\s,]+/).map(Number);
  if (box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) return { x: box[0], y: box[1], w: box[2], h: box[3] };
  const [w, h] = [number(svg.attrs.width), number(svg.attrs.height)];
  if (w > 0 && h > 0) return { x: 0, y: 0, w, h };
  throw new Unsupported("no size");
}

function number(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function round(n, places = 2) {
  const scale = 10 ** places;
  return Math.round(n * scale) / scale || 0;
}

const TAG = /<!--[\s\S]*?-->|<[?!][^>]*>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ATTRIBUTE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** The elements of a piece of markup as a tree; text between tags, comments and declarations are dropped. */
function parse(markup) {
  const top = [];
  const open = [];
  for (const [, close, name, attrs, selfClosing] of markup.matchAll(TAG)) {
    if (close) {
      if (open.pop()?.name !== close) throw new Unsupported("markup");
      continue;
    }
    if (!name) continue;
    const node = { name, attrs: {}, children: [] };
    for (const [, key, double, single] of attrs.matchAll(ATTRIBUTE)) node.attrs[key] = double ?? single;
    (open.at(-1)?.children ?? top).push(node);
    if (!selfClosing) open.push(node);
  }
  if (open.length) throw new Unsupported("markup");
  return top;
}

function declarations(style = "") {
  const out = {};
  for (const declaration of style.split(";")) {
    const at = declaration.indexOf(":");
    if (at > 0) out[declaration.slice(0, at).trim()] = declaration.slice(at + 1).trim();
  }
  return out;
}

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;

function reader(d) {
  let i = 0;
  const skip = () => {
    while (i < d.length && " \t\n\r\f,".includes(d[i])) i++;
  };
  return {
    command() {
      skip();
      if (i >= d.length) return null;
      if (!/[MmZzLlHhVvCcSsQqTtAa]/.test(d[i])) throw new Unsupported("path data");
      return d[i++];
    },
    more() {
      skip();
      return i < d.length && /[-+.\d]/.test(d[i]);
    },
    number() {
      skip();
      NUMBER.lastIndex = i;
      const match = NUMBER.exec(d);
      if (!match) throw new Unsupported("path data");
      i = NUMBER.lastIndex;
      return Number(match[0]);
    },
    // Arc flags are one digit each and may run straight into the next number, as in "a1 1 0 011 1".
    flag() {
      skip();
      if (d[i] !== "0" && d[i] !== "1") throw new Unsupported("path data");
      return Number(d[i++]);
    },
  };
}

/** Writes path data as short as SVG allows: a command letter only when it changes, and no space a sign or point makes needless. */
function writer() {
  let text = "";
  let last = "";
  let previous = "";
  let at = [0, 0];
  let start = [0, 0];
  const letter = (command) => {
    // Pairs straight after a move are read as lines, so a line there needs no letter of its own.
    const implied = (last === "M" && command === "L") || (last === "m" && command === "l");
    if ((command !== last && !implied) || command === "M" || command === "m") {
      text += command;
      previous = "";
    }
    last = command;
  };
  const put = (value) => {
    const s = String(round(value)).replace(/^(-?)0\./, "$1.");
    if (previous && s[0] !== "-" && !(s[0] === "." && previous.includes("."))) text += " ";
    text += s;
    previous = s;
  };
  const relative = (command) => command === command.toLowerCase();
  const step = (command, [x, y]) => {
    put(relative(command) ? x - at[0] : x);
    put(relative(command) ? y - at[1] : y);
  };
  return {
    points(command, points) {
      letter(command);
      for (const point of points) step(command, point);
      at = points.at(-1);
      if (command === "M" || command === "m") start = at;
    },
    axis(command, point) {
      letter(command);
      const index = command.toUpperCase() === "H" ? 0 : 1;
      put(relative(command) ? point[index] - at[index] : point[index]);
      at = point;
    },
    arc(command, [rx, ry, angle, sweep], large, point) {
      letter(command);
      for (const value of [rx, ry, angle, large, sweep]) put(value);
      step(command, point);
      at = point;
    },
    close(command) {
      letter(command);
      at = start;
    },
    text: () => text,
  };
}
