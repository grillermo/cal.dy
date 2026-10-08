import type { RouterInputs, RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";

export type VennContact = RouterOutputs["viewer"]["venn"]["contacts"]["list"][number];
export type VennContactInput = RouterInputs["viewer"]["venn"]["contacts"]["add"];

export function useVennContacts() {
  const utils = trpc.useUtils();
  const query = trpc.viewer.venn.contacts.list.useQuery();
  const invalidate = () => utils.viewer.venn.contacts.list.invalidate();

  const addMutation = trpc.viewer.venn.contacts.add.useMutation({ onSuccess: invalidate });
  const updateMutation = trpc.viewer.venn.contacts.update.useMutation({ onSuccess: invalidate });
  const removeMutation = trpc.viewer.venn.contacts.remove.useMutation({ onSuccess: invalidate });

  return {
    contacts: query.data ?? [],
    isLoading: query.isPending,
    add: (input: VennContactInput) => addMutation.mutateAsync(input),
    update: (input: RouterInputs["viewer"]["venn"]["contacts"]["update"]) =>
      updateMutation.mutateAsync(input),
    remove: (input: RouterInputs["viewer"]["venn"]["contacts"]["remove"]) =>
      removeMutation.mutateAsync(input),
  };
}
