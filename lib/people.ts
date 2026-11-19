import type { Person } from "./types";

/** "My Mother-In-Law" -> "mother-in-law" */
export function normalize(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/^(my|our)\s+/, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ");
}

/** Find a person by exact name or alias. Claude does fuzzier matching server-side. */
export function findPerson(people: Person[], spokenAs: string): Person | null {
  const target = normalize(spokenAs);
  if (!target) return null;
  return (
    people.find(
      (p) =>
        normalize(p.name) === target ||
        p.aliases.some((a) => normalize(a) === target),
    ) ?? null
  );
}

/**
 * Link that opens iPhone Messages with the text filled in.
 * With no number, Messages opens a new message and you pick the person.
 */
export function smsHref(phone: string, body: string): string {
  const number = phone.replace(/[^\d+]/g, "");
  return `sms:${number}&body=${encodeURIComponent(body)}`;
}
