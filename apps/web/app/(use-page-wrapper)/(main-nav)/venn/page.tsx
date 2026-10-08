import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { _generateMetadata, getTranslate } from "app/_utils";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import VennView from "~/venn/views/venn-view";
import { ShellMainAppDir } from "../ShellMainAppDir";

const Page = async () => {
  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });
  if (!session?.user?.id) {
    return redirect("/auth/login?callbackUrl=/venn");
  }
  const t = await getTranslate();

  return (
    <ShellMainAppDir heading={t("venn")} subtitle={t("venn_description")}>
      <VennView />
    </ShellMainAppDir>
  );
};

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("venn"),
    (t) => t("venn_description"),
    undefined,
    undefined,
    "/venn"
  );

export default Page;
