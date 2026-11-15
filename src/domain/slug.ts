const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyBusinessName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("Enter a name that can become a URL slug.");
  }

  return slug;
}

export function isBusinessSlug(value: string): boolean {
  return SLUG_PATTERN.test(value) && value.length <= 48;
}
