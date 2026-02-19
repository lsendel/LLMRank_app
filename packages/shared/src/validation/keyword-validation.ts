export const KEYWORD_MAX_LENGTH = 200;

const BLOCKED_PATTERNS = [
  /ignore\s+(all\s+)?previous/i,
  /system\s*:/i,
  /<\|/,
  /\|>/,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /you\s+are\s+(now|a)\s/i,
  /pretend\s+you/i,
  /act\s+as\s+(if|a)\s/i,
  /forget\s+(all|everything|your)/i,
  /do\s+not\s+follow/i,
  /override\s+(your|the)/i,
  /new\s+instructions/i,
];

const ALLOWED_CHARS = /^[\p{L}\p{N}\s.,!?'"()\-/:&@#%+]+$/u;

export function validateKeyword(keyword: string): {
  valid: boolean;
  reason?: string;
} {
  const trimmed = keyword.trim();
  if (trimmed.length === 0) return { valid: false, reason: "Keyword is empty" };
  if (trimmed.length > KEYWORD_MAX_LENGTH)
    return {
      valid: false,
      reason: `Keyword exceeds ${KEYWORD_MAX_LENGTH} characters`,
    };
  if (!ALLOWED_CHARS.test(trimmed))
    return { valid: false, reason: "Keyword contains invalid characters" };
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed))
      return { valid: false, reason: "Keyword contains blocked pattern" };
  }
  return { valid: true };
}
