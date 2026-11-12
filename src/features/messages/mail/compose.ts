export type ComposeDraft = { to: string; subject: string; replyTo?: string };

export function splitRecipients(text: string): string[] {
  return text.split(/[,;，；\s]+/).map((part) => part.trim()).filter(Boolean);
}
