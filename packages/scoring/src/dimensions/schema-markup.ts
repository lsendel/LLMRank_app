import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";

// Required properties for common schema types
const SCHEMA_REQUIRED_PROPS: Record<string, string[]> = {
  Article: ["headline", "author", "datePublished"],
  WebPage: ["name", "description"],
  Organization: ["name", "url"],
  Product: ["name", "description"],
  FAQPage: ["mainEntity"],
  LocalBusiness: ["name", "address"],
};

export function scoreSchemaMarkup(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // NO_STRUCTURED_DATA: -15 if no structured_data
  const structuredData = page.extracted.structured_data ?? [];
  if (structuredData.length === 0) {
    deduct(s, "NO_STRUCTURED_DATA");
  }

  // INCOMPLETE_SCHEMA: -8 if schema exists but missing required props
  if (structuredData.length > 0) {
    for (const schema of structuredData) {
      const schemaObj = schema as Record<string, unknown>;
      const schemaType = schemaObj["@type"] as string | undefined;
      if (schemaType && SCHEMA_REQUIRED_PROPS[schemaType]) {
        const requiredProps = SCHEMA_REQUIRED_PROPS[schemaType];
        const missingProps = requiredProps.filter(
          (prop) => !(prop in schemaObj),
        );
        if (missingProps.length > 0) {
          deduct(s, "INCOMPLETE_SCHEMA", {
            schemaType,
            missingProps,
          });
          break; // Only deduct once
        }
      }
    }
  }

  // INVALID_SCHEMA: -8 if structured data has parse errors
  if (structuredData.length > 0) {
    const hasInvalidSchema = structuredData.some((schema) => {
      const obj = schema as Record<string, unknown>;
      return !obj["@type"];
    });
    if (hasInvalidSchema) {
      deduct(s, "INVALID_SCHEMA");
    }
  }

  // MISSING_ENTITY_MARKUP: -5 if key entities not in schema
  const entityTypes = ["Person", "Organization", "Product", "Place", "Event"];
  const hasEntityMarkup = page.extracted.schema_types.some((t) =>
    entityTypes.includes(t),
  );
  if (structuredData.length > 0 && !hasEntityMarkup) {
    deduct(s, "MISSING_ENTITY_MARKUP");
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
