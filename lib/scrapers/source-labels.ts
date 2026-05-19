// Display labels for each ScrapeSourceType. Used by the search-table's
// Source column to render "Greenhouse" rather than "GREENHOUSE", etc.
// Typed as Record<ScrapeSourceTypeInput, string> so adding a new enum
// value is a compile error here until you fill it in.

import type { ScrapeSourceTypeInput } from "../zod-schemas";

export const SOURCE_TYPE_LABELS: Record<ScrapeSourceTypeInput, string> = {
  GREENHOUSE: "Greenhouse",
  LEVER: "Lever",
  ASHBY: "Ashby",
  WORKDAY: "Workday",
  REMOTEOK: "RemoteOK",
  SIMPLIFY_SUMMER: "Simplify · Summer",
  SIMPLIFY_NEWGRAD: "Simplify · New Grad",
  OUCKAH_SUMMER: "vansh · Summer",
};
