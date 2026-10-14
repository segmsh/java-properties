import { assert, describe, it } from "vitest";
import eol from "eol";
import fs from "fs";
import path from "path";
import { parse as parseProperties } from "dot-properties";
import JavaPropertiesProcessor from "../src";

const processor = new JavaPropertiesProcessor();

const fixtures = ["typical.properties", "example.properties", "edge.properties"];

function readFixture(filename: string): string {
  return eol.lf(
    fs.readFileSync(path.join("test", "fixtures", filename), {
      encoding: "utf-8",
    }),
  );
}

// Last occurrence of each key, as Java resolves duplicates
function lastByKey(
  segments: { text: string; metadata?: Record<string, unknown> }[],
): Record<string, string> {
  return Object.fromEntries(
    segments.map(({ text, metadata }) => [String(metadata?.key), text]),
  );
}

describe("JavaPropertiesProcessorTest", function () {
  fixtures.forEach((filename) => {
    it(`should process ${filename} correctly`, function () {
      const input = readFixture(filename);
      const document = processor.parse(input);
      const roundTripped = processor.parse(processor.stringify(document));

      assert.equal(JSON.stringify(roundTripped), JSON.stringify(document));
    });

    it(`should roundtrip ${filename} exactly`, function () {
      const input = readFixture(filename);

      assert.equal(processor.stringify(processor.parse(input)), input);
    });

    it(`should map ${filename} segments to their values`, function () {
      const input = readFixture(filename);
      const parsed = parseProperties(input) as Record<string, string>;

      Object.entries(lastByKey(processor.parse(input).segments)).forEach(
        ([key, value]) => {
          assert.equal(parsed[key], value, key);
        },
      );
    });

    it(`should keep ${filename} valid after translation`, function () {
      const input = readFixture(filename);
      const document = processor.parse(input);
      const samples = [
        "Übersetzt 日本語 😀",
        "  leading and trailing spaces  ",
        "back\\slash and\ttab",
        "multi\nline\r\ntext",
        "#starts like a comment",
        "= and : separators",
        "ends with backslash\\",
        "control \u0001 char",
      ];

      document.segments.forEach((current, index) => {
        current.text = samples[index % samples.length];
      });

      const parsed = parseProperties(processor.stringify(document)) as Record<
        string,
        string
      >;

      Object.entries(lastByKey(document.segments)).forEach(([key, value]) => {
        assert.equal(parsed[key], value, key);
      });
    });
  });

  it("should decode keys and values", function () {
    const document = processor.parse(readFixture("example.properties"));

    assert.deepEqual(
      document.segments.map(({ text, metadata }) => [metadata?.key, text]),
      [
        ["greeting", "Hello!\nHow are you?"],
        ["greeting1", "Hello!"],
        ["greeting2", "Hello!"],
        ["welcome", "¡Bienvenidos todos!"],
      ],
    );
  });

  it("should join continuation lines", function () {
    const document = processor.parse(
      "a = First, \\\n    second\nb = Next\n",
    );

    assert.deepEqual(
      document.segments.map(({ text }) => text),
      ["First, second", "Next"],
    );
  });

  it("should skip empty values", function () {
    const document = processor.parse("a =\nb =   \nc\nd = Text\n");

    assert.deepEqual(
      document.segments.map(({ metadata }) => metadata?.key),
      ["d"],
    );
  });

  it("should keep the separator style when translating", function () {
    const document = processor.parse("a=One\nb: Two\nc   Three\n");

    document.segments.forEach((current) => {
      current.text = `${current.text}!`;
    });

    assert.equal(processor.stringify(document), "a=One!\nb: Two!\nc   Three!\n");
  });

  it("should escape non-ASCII text in ASCII-only files", function () {
    const document = processor.parse("a = Hello\n");

    document.segments[0].text = "¡Hola! 😀";

    assert.equal(
      processor.stringify(document),
      "a = \\u00A1Hola! \\uD83D\\uDE00\n",
    );
  });

  it("should keep non-ASCII text in UTF-8 files", function () {
    const document = processor.parse("a = Héllo\n");

    document.segments[0].text = "¡Hola!";

    assert.equal(processor.stringify(document), "a = ¡Hola!\n");
  });

  it("should give duplicate keys unique ids", function () {
    const document = processor.parse("a = One\na = Two\n");
    const ids = document.segments.map(({ id }) => id);

    assert.equal(new Set(ids).size, 2);
  });

  it("should produce deterministic ids", function () {
    const input = readFixture("edge.properties");

    assert.deepEqual(processor.parse(input), processor.parse(input));
  });
});
