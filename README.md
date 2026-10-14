# @segmsh/java-properties

Java properties processor for [segm.sh](https://segm.sh). This package parses `.properties` files into a document (AST + segments) and stringifies them back, treating values as translatable segments while leaving everything else byte-for-byte intact.

## Installation

```bash
npm install @segmsh/java-properties
```

## Usage

```typescript
import JavaPropertiesProcessor from "@segmsh/java-properties";

const processor = new JavaPropertiesProcessor();

const content = "# Greetings\nwelcome = \\u00a1Bienvenidos!\n";
const document = processor.parse(content);
// document.segments[0].text === "¡Bienvenidos!"
// document.segments[0].metadata === { key: "welcome" }

// ... modify document segments ...

const newContent = processor.stringify(document);
```

## Features

- **Source Preservation**: Comments, blank lines, separators (`=`, `:`, whitespace) and line continuations are kept exactly as written.
- **Escapes**: Values are decoded (`\n`, `\t`, `\uXXXX`, line continuations), so segments contain plain text; translated text is escaped back.
- **Encoding**: In ASCII-only files, non-ASCII translations are written as `\uXXXX` escapes; UTF-8 files keep them as is.
- **Key Paths**: Each segment carries its property key in `metadata.key`. Empty values are not segmented.
- **Round-trip**: Parsing and stringifying an unchanged document returns the original input.

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## License

[Apache-2.0](LICENSE)
