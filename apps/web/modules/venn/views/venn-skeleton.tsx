"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Skeleton } from "@coss/ui/components/skeleton";
import { ShellMainAppDir } from "app/(use-page-wrapper)/(main-nav)/ShellMainAppDir";

export const VennSkeleton = () => {
  const { t } = useLocale();
  return (
    <ShellMainAppDir heading={t("venn")} subtitle={t("venn_description")}>
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="stack-y-3 lg:w-1/3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="h-64 w-full lg:w-2/3" />
      </div>
    </ShellMainAppDir>
  );
};
