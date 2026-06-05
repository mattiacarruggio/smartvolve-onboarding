import { notFound } from "next/navigation";
import { getTenant } from "@/lib/onboarding/config";
import { OnboardingChat } from "@/components/onboarding/OnboardingChat";

/**
 * /onboarding/[tenantId] — public onboarding chat page.
 *
 * Server component that validates the tenant slug, then delegates to the
 * client-side chat UI. Unknown slugs → 404.
 */
export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = getTenant(tenantId);
  if (!tenant) notFound();

  return (
    <OnboardingChat
      tenantId={tenantId}
      displayName={tenant.displayName}
    />
  );
}
