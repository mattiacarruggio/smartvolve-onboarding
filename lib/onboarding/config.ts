/**
 * Onboarding portal — tenant configuration.
 *
 * Maps each tenant slug (used in the URL: /onboarding/<tenantId>) to its
 * display name (shown in the chat header) and agentName (reserved for future
 * multi-agent routing on the backend).
 *
 * To add a new tenant, append an entry below — no other changes required.
 */

export interface TenantConfig {
  /** Human-readable name shown in the chat UI header. */
  displayName: string;
  /** Logical agent identifier (for future backend routing). */
  agentName: string;
}

export const tenants: Record<string, TenantConfig> = {
  "demo": {
    displayName: "Azienda Demo",
    agentName: "onboarding-demo",
  },
  "studio-rossi": {
    displayName: "Studio Rossi",
    agentName: "onboarding-studio-rossi",
  },
  "immobiliare-verde": {
    displayName: "Immobiliare Verde",
    agentName: "onboarding-immobiliare-verde",
  },
} as const;

/**
 * Type-safe lookup. Returns `undefined` for unknown slugs so the page can
 * `notFound()` cleanly.
 */
export function getTenant(tenantId: string): TenantConfig | undefined {
  return tenants[tenantId];
}
