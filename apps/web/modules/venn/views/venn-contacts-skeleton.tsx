"use client";

import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Skeleton } from "@coss/ui/components/skeleton";

export const VennContactsSkeleton = () => {
  const { t } = useLocale();
  return (
    <SettingsHeader
      title={t("venn_contacts")}
      description={t("venn_contacts_description")}
      borderInShellHeader={true}>
      <div className="border-subtle stack-y-6 rounded-b-xl border border-t-0 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </SettingsHeader>
  );
};
