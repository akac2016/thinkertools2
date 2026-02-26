import assert from "node:assert/strict";
import test from "node:test";

import {
  isUsernameAppropriate,
  normalizeUsernameInput,
  validateUsername,
} from "../lib/auth/username-rules.ts";

test("normalizeUsernameInput lowercases and trims", () => {
  assert.equal(normalizeUsernameInput("  Alice.Example  "), "alice.example");
});

test("validateUsername accepts a clean username", () => {
  const result = validateUsername("alice.example_42");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.username, "alice.example_42");
  }
});

test("validateUsername rejects profane usernames", () => {
  const result = validateUsername("f4ckwizard");
  assert.equal(result.ok, false);
});

test("validateUsername rejects reserved usernames", () => {
  const result = validateUsername("admin-team");
  assert.equal(result.ok, false);
});

test("isUsernameAppropriate matches validation outcome", () => {
  assert.equal(isUsernameAppropriate("good_name"), true);
  assert.equal(isUsernameAppropriate("shit-talker"), false);
});
