import { containsProfanity } from "./profanity-filter.ts";

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;

const INAPPROPRIATE_PATTERNS = [
  /^\d+$/,
  /^[._-]+$/,
  /admin/i,
  /moderator/i,
  /support/i,
  /test/i,
];

export type UsernameValidationResult =
  | { ok: true; username: string }
  | { ok: false; message: string };

export function normalizeUsernameInput(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  return input.trim().toLowerCase();
}

export function validateUsername(input: string): UsernameValidationResult {
  const username = normalizeUsernameInput(input);
  if (!username) {
    return {
      ok: false,
      message: "Username is required.",
    };
  }

  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters.`,
    };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      message: "Username can only use lowercase letters, numbers, dots, underscores, and hyphens.",
    };
  }

  if (containsProfanity(username)) {
    return {
      ok: false,
      message: "Username is not allowed.",
    };
  }

  if (INAPPROPRIATE_PATTERNS.some((pattern) => pattern.test(username))) {
    return {
      ok: false,
      message: "Username is not allowed.",
    };
  }

  return {
    ok: true,
    username,
  };
}

export function isUsernameAppropriate(input: string): boolean {
  return validateUsername(input).ok;
}
