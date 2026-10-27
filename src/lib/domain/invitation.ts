import { z } from "zod";

/** Public-safe invitation content. Never contains private planner records. */

export const invitationSectionIds = [
  "cover",
  "greeting",
  "invitation",
  "story",
  "date",
  "ceremony",
  "reception",
  "venues",
  "schedule",
  "dressCode",
  "gallery",
  "reminders",
  "faq",
  "gifts",
  "rsvp",
  "closing",
] as const;

export const invitationTemplateIds = [
  "romantic-floral",
  "minimal-modern",
  "classic-formal",
  "garden",
  "cinematic-editorial",
] as const;

export const invitationSectionSchema = z.object({
  id: z.enum(invitationSectionIds),
  visible: z.boolean().default(true),
});

export const invitationContentSchema = z.object({
  coverKicker: z.string().max(120).default("Together with their families"),
  coverHeading: z.string().max(200).default(""),
  invitationMessage: z.string().max(2000).default(""),
  storyTitle: z.string().max(120).default("Our Story"),
  story: z.string().max(4000).default(""),
  ceremonyTime: z.string().max(40).default(""),
  receptionTime: z.string().max(40).default(""),
  venueIds: z.array(z.string().uuid()).default([]),
  mapUrl: z.string().url().max(500).or(z.literal("")).default(""),
  dressCode: z.string().max(300).default(""),
  reminders: z.array(z.string().max(300)).max(12).default([]),
  faq: z.array(z.object({ q: z.string().max(300), a: z.string().max(1000) })).max(12).default([]),
  galleryPaths: z.array(z.string().max(400)).max(12).default([]),
  coverImagePath: z.string().max(400).default(""),
  monogramText: z.string().max(6).default("M & J"),
  giftNote: z.string().max(1000).default(""),
  registry: z
    .array(z.object({ label: z.string().max(120), url: z.string().url().max(400) }))
    .max(6)
    .default([]),
  closingMessage: z.string().max(600).default(""),
  sections: z.array(invitationSectionSchema).default(
    invitationSectionIds.map((id) => ({ id, visible: true })),
  ),
});

export const invitationThemeSchema = z.object({
  template: z.enum(invitationTemplateIds).default("romantic-floral"),
  palette: z
    .object({
      bg: z.string().max(20).optional(),
      surface: z.string().max(20).optional(),
      primary: z.string().max(20).optional(),
      accent: z.string().max(20).optional(),
      text: z.string().max(20).optional(),
      muted: z.string().max(20).optional(),
    })
    .default({}),
  headingFont: z.enum(["cormorant", "playfair", "ebgaramond", "dancing"]).default("cormorant"),
  scriptFont: z.enum(["vibes", "dancing"]).default("vibes"),
  ornament: z.enum(["floral", "geometric", "none"]).default("floral"),
  musicUrl: z.string().url().max(500).or(z.literal("")).default(""),
});

export type InvitationContent = z.infer<typeof invitationContentSchema>;
export type InvitationTheme = z.infer<typeof invitationThemeSchema>;

const DEFAULT_PALETTE: NonNullable<InvitationTheme["palette"]> = {
  bg: "#FDF4F1",
  surface: "#FFFFFF",
  primary: "#9D2C4E",
  accent: "#A16207",
  text: "#3B2A2E",
  muted: "#8A777C",
};

export function parseInvitationContent(raw: unknown): InvitationContent {
  const parsed = invitationContentSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : invitationContentSchema.parse({});
}

export function parseInvitationTheme(raw: unknown): InvitationTheme {
  const parsed = invitationThemeSchema.safeParse(raw ?? {});
  const t = parsed.success ? parsed.data : invitationThemeSchema.parse({});
  return {
    ...t,
    palette: { ...DEFAULT_PALETTE, ...(t.palette ?? {}) },
  };
}

export const TEMPLATE_PRESETS: Record<
  (typeof invitationTemplateIds)[number],
  { label: string; description: string; theme: Partial<InvitationTheme> }
> = {
  "romantic-floral": {
    label: "Romantic Floral",
    description: "Blush and ivory with delicate floral ornaments.",
    theme: {
      palette: {
        bg: "#FDF4F1",
        surface: "#FFFFFF",
        primary: "#9D2C4E",
        accent: "#A16207",
        text: "#3B2A2E",
        muted: "#8A777C",
      },
      ornament: "floral",
      headingFont: "cormorant",
      scriptFont: "vibes",
    },
  },
  "minimal-modern": {
    label: "Minimal Modern",
    description: "Clean off-white, thin rules, restrained type.",
    theme: {
      palette: {
        bg: "#FAFAF8",
        surface: "#FFFFFF",
        primary: "#2E2A26",
        accent: "#8A7360",
        text: "#26221E",
        muted: "#8B8580",
      },
      ornament: "geometric",
      headingFont: "cormorant",
      scriptFont: "vibes",
    },
  },
  "classic-formal": {
    label: "Classic Formal",
    description: "Ivory and gold with formal centered typography.",
    theme: {
      palette: {
        bg: "#FBF7EC",
        surface: "#FFFFFF",
        primary: "#1F1B16",
        accent: "#A16207",
        text: "#241F19",
        muted: "#857B6C",
      },
      ornament: "geometric",
      headingFont: "ebgaramond",
      scriptFont: "vibes",
    },
  },
  garden: {
    label: "Garden",
    description: "Sage and cream, botanical corners, airy layout.",
    theme: {
      palette: {
        bg: "#F4F6EF",
        surface: "#FFFFFF",
        primary: "#5A6E4E",
        accent: "#8A6D3B",
        text: "#2F362A",
        muted: "#7C8573",
      },
      ornament: "floral",
      headingFont: "cormorant",
      scriptFont: "dancing",
    },
  },
  "cinematic-editorial": {
    label: "Cinematic Editorial",
    description: "Charcoal and blush, dramatic full-bleed cover.",
    theme: {
      palette: {
        bg: "#1D1A1B",
        surface: "#262223",
        primary: "#E8B4C0",
        accent: "#C9A227",
        text: "#F5EDEE",
        muted: "#A99DA1",
      },
      ornament: "none",
      headingFont: "playfair",
      scriptFont: "vibes",
    },
  },
};
