import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { _generateMetadata } from "app/_utils";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import VennContactsView from "~/venn/views/venn-contacts-view";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("venn_contacts"),
    (t) => t("venn_contacts_description"),
    undefined,
    undefined,
    "/settings/my-account/venn-contacts"
  );

const Page = async () => {
  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });
  if (!session?.user?.id) {
    return redirect("/auth/login?callbackUrl=/settings/my-account/venn-contacts");
  }

  return <VennContactsView />;
};

export default Page;
