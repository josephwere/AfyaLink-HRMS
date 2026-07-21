import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readAppSource() {
  return readFileSync(path.resolve(__dirname, "App.jsx"), "utf8");
}

describe("canonical route parity", () => {
  it("registers the driver and mortuary operations landing pages", () => {
    const source = readAppSource();

    expect(source).toContain('path="/app/operations/driver/home"');
    expect(source).toContain('path="/app/operations/mortuary/home"');
  });
});
