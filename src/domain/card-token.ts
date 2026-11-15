export const CARD_COOKIE = "iago_card";

const TOKEN = /^[A-Za-z0-9_-]{20,}$/;
const STAMP_CODE = /^[A-Za-z0-9_-]{16,}$/;

export function isCardToken(value: string) {
  return TOKEN.test(value);
}

export function isStampCode(value: string) {
  return STAMP_CODE.test(value);
}

export function membershipTokenFromInput(value: string): string | null {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/\/c\/([A-Za-z0-9_-]{20,})(?=[/?#]|$)/);
  if (fromUrl?.[1]) {
    return fromUrl[1];
  }
  if (TOKEN.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function hexColor(value: string | null | undefined, fallback: string) {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}
