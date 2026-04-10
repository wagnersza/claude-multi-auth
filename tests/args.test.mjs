import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseArgs, splitRawArgumentString } from "../plugins/cma/scripts/lib/args.mjs";

describe("parseArgs", () => {
  it("parses value options", () => {
    const result = parseArgs(["--profile", "bedrock", "--model", "opus"], {
      valueOptions: ["profile", "model"]
    });
    assert.deepStrictEqual(result.options, { profile: "bedrock", model: "opus" });
    assert.deepStrictEqual(result.positionals, []);
  });

  it("parses boolean options", () => {
    const result = parseArgs(["--write", "--background"], {
      booleanOptions: ["write", "background"]
    });
    assert.deepStrictEqual(result.options, { write: true, background: true });
  });

  it("collects positionals", () => {
    const result = parseArgs(["analyze", "the", "auth", "flow"], {});
    assert.deepStrictEqual(result.positionals, ["analyze", "the", "auth", "flow"]);
  });

  it("handles aliases", () => {
    const result = parseArgs(["-m", "opus"], {
      valueOptions: ["model"],
      aliasMap: { m: "model" }
    });
    assert.deepStrictEqual(result.options, { model: "opus" });
  });

  it("handles inline values with =", () => {
    const result = parseArgs(["--profile=bedrock"], {
      valueOptions: ["profile"]
    });
    assert.deepStrictEqual(result.options, { profile: "bedrock" });
  });

  it("accumulates repeated value options into array", () => {
    const result = parseArgs(["--env", "KEY1=val1", "--env", "KEY2=val2"], {
      valueOptions: ["env"]
    });
    assert.deepStrictEqual(result.options, { env: ["KEY1=val1", "KEY2=val2"] });
  });

  it("handles -- passthrough", () => {
    const result = parseArgs(["--write", "--", "--not-an-option"], {
      booleanOptions: ["write"]
    });
    assert.deepStrictEqual(result.options, { write: true });
    assert.deepStrictEqual(result.positionals, ["--not-an-option"]);
  });

  it("throws on missing value", () => {
    assert.throws(
      () => parseArgs(["--profile"], { valueOptions: ["profile"] }),
      /Missing value for --profile/
    );
  });
});

describe("splitRawArgumentString", () => {
  it("splits simple tokens", () => {
    assert.deepStrictEqual(splitRawArgumentString("--profile bedrock hello"), [
      "--profile", "bedrock", "hello"
    ]);
  });

  it("handles quoted strings", () => {
    assert.deepStrictEqual(
      splitRawArgumentString('--profile "my profile" hello'),
      ["--profile", "my profile", "hello"]
    );
  });

  it("handles single quotes", () => {
    assert.deepStrictEqual(
      splitRawArgumentString("--profile 'my profile' hello"),
      ["--profile", "my profile", "hello"]
    );
  });

  it("handles escaped characters", () => {
    assert.deepStrictEqual(splitRawArgumentString("hello\\ world"), ["hello world"]);
  });

  it("returns empty array for empty string", () => {
    assert.deepStrictEqual(splitRawArgumentString(""), []);
  });
});
