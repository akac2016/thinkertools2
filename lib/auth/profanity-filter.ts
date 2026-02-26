/**
 * Profanity filter powered by @2toad/profanity with extra obfuscation checks.
 */

import { CensorType, Profanity } from "@2toad/profanity";

const customProfanity = new Profanity({
  wholeWord: false,
  unicodeWordBoundaries: true,
});

const obfuscationPatterns = [
  /\bf[\W_]*u[\W_]*c[\W_]*k\b/i,
  /\bs[\W_]*h[\W_]*i[\W_]*t\b/i,
  /\bb[\W_]*i[\W_]*t[\W_]*c[\W_]*h\b/i,
  /\b[a@4][\W_]*s[\W_]*s\b/i,
  /\bd[\W_]*a[\W_]*m[\W_]*n\b/i,
  /\bh[\W_]*e[\W_]*l[\W_]*l\b/i,
  /\bn[\W_]*i[\W_]*g[\W_]*g[\W_]*[a@e][\W_]*r?\b/i,
  /\bf@ck\b/i,
  /f@ck/i,
  /\bsh1t\b/i,
  /sh1t/i,
  /\bb1tch\b/i,
  /b1tch/i,
  /\b@ss\b/i,
  /@ss/i,
  /\bf4ck\b/i,
  /f4ck/i,
  /\b5h1t\b/i,
  /\bnigg@\b/i,
  /nigg@/i,
  /\bf\.u\.c\.k\b/i,
  /\bs-h-i-t\b/i,
  /\bb_i_t_c_h\b/i,
  /\bfu+c+k+\b/i,
  /\bshi+t+\b/i,
];

export function containsProfanity(text: string): boolean {
  if (!text || typeof text !== "string") {
    return false;
  }

  if (customProfanity.exists(text)) {
    return true;
  }

  const normalized = text.toLowerCase();
  return obfuscationPatterns.some((pattern) => pattern.test(normalized));
}

export function sanitizeText(text: string, replacement = "***"): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  if (!containsProfanity(text)) {
    return text;
  }

  return customProfanity.censor(text, CensorType.Word, [replacement]);
}

export function addProfanityWords(words: string[]): void {
  customProfanity.addWords(words);
}

export function removeProfanityWords(words: string[]): void {
  customProfanity.removeWords(words);
}

export function addWhitelistWords(words: string[]): void {
  customProfanity.whitelist.addWords(words);
}

export function removeWhitelistWords(words: string[]): void {
  customProfanity.whitelist.removeWords(words);
}
