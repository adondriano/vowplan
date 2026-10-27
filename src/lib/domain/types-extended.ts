import type { InvitationContent, InvitationTheme } from "./invitation";
import type { Venue, WeddingEvent } from "./types";

export type { InvitationContent, InvitationTheme };
export type { Venue, WeddingEvent };

export type InvitationVersion = {
  id: string;
  wedding_id: string;
  version: number;
  content: InvitationContent;
  theme: InvitationTheme;
  published: boolean;
  published_at: string | null;
  created_at: string;
};
