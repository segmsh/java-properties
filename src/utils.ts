export interface ValueToken {
  start: number;
  end: number;
  raw: string;
  value: string;
  key: string;
}

const ESCAPES: Record<string, string> = {
  t: "\t",
  n: "\n",
  r: "\r",
  f: "\f",
};

const ENCODES: Record<string, string> = {
  "\\": "\\\\",
  "\t": "\\t",
  "\n": "\\n",
  "\r": "\\r",
  "\f": "\\f",
};

const isWhitespace = (char: string | undefined): boolean =>
  char === " " || char === "\t" || char === "\f";

const isLineEnd = (char: string | undefined): boolean =>
  char === undefined || char === "\n" || char === "\r";

// Length of the line terminator at the index (\r\n counts as one)
const lineEndLength = (source: string, index: number): number =>
  source.startsWith("\r\n", index) ? 2 : isLineEnd(source[index]) ? 1 : 0;

// Skips a line continuation (backslash + terminator) and the next line's indentation
const skipContinuation = (source: string, index: number): number => {
  let next = index + 1 + lineEndLength(source, index + 1);
  while (isWhitespace(source[next])) next++;
  return next;
};

const isContinuation = (source: string, index: number): boolean =>
  source[index] === "\\" && isLineEnd(source[index + 1]);

export const decode = (raw: string): string => {
  let result = "";

  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== "\\") {
      result += raw[i];
      continue;
    }

    if (isContinuation(raw, i)) {
      i = skipContinuation(raw, i) - 1;
      continue;
    }

    const next = raw[i + 1];

    if (next === "u" && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) {
      result += String.fromCharCode(parseInt(raw.slice(i + 2, i + 6), 16));
      i += 5;
      continue;
    }

    result += ESCAPES[next] ?? next;
    i++;
  }

  return result;
};

const toUnicodeEscape = (code: number): string =>
  `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;

// Keeps the raw value when unchanged; escapes non-ASCII only for ASCII-only sources
export const encode = (value: string, raw: string, ascii: boolean): string => {
  if (decode(raw) === value) return raw;

  let result = "";

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const code = value.charCodeAt(i);

    if (char in ENCODES) {
      result += ENCODES[char];
    } else if (i === 0 && char === " ") {
      // Leading whitespace is otherwise dropped as part of the separator
      result += "\\ ";
    } else if (code < 0x20 || code === 0x7f || (ascii && code > 0x7e)) {
      result += toUnicodeEscape(code);
    } else {
      result += char;
    }
  }

  return result;
};

export const scan = (source: string): ValueToken[] => {
  const tokens: ValueToken[] = [];
  let index = 0;

  const skipWhitespace = () => {
    for (;;) {
      if (isWhitespace(source[index])) {
        index++;
      } else if (isContinuation(source, index)) {
        index = skipContinuation(source, index);
      } else {
        return;
      }
    }
  };

  while (index < source.length) {
    while (isWhitespace(source[index])) index++;

    const lineEnd = lineEndLength(source, index);

    if (lineEnd) {
      index += lineEnd;
      continue;
    }

    // Comments are never continued
    if (source[index] === "#" || source[index] === "!") {
      while (!isLineEnd(source[index])) index++;
      continue;
    }

    const keyStart = index;

    while (!isLineEnd(source[index])) {
      const char = source[index];

      if (isContinuation(source, index)) {
        index = skipContinuation(source, index);
      } else if (char === "\\") {
        index += 2;
      } else if (char === "=" || char === ":" || isWhitespace(char)) {
        break;
      } else {
        index++;
      }
    }

    const key = decode(source.slice(keyStart, index));

    skipWhitespace();

    if (source[index] === "=" || source[index] === ":") {
      index++;
      skipWhitespace();
    }

    const valueStart = index;

    while (!isLineEnd(source[index])) {
      if (isContinuation(source, index)) {
        index = skipContinuation(source, index);
      } else {
        index += source[index] === "\\" ? 2 : 1;
      }
    }

    // An escape at the very end may step past the source
    index = Math.min(index, source.length);

    const raw = source.slice(valueStart, index);

    tokens.push({ start: valueStart, end: index, raw, value: decode(raw), key });
  }

  return tokens;
};
