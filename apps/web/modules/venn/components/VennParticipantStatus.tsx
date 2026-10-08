"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import classNames from "@calcom/ui/classNames";
import type { VennParticipant } from "../hooks/useVennSearch";

const PROVIDER_LABELS: Record<NonNullable<VennParticipant["provider"]>, string> = {
  CALENDLY: "Calendly",
  CALCOM: "Cal.com",
  LOCAL: "Cal.diy",
};

const STATUS_GLYPHS: Record<VennParticipant["status"], string> = {
  DONE: "✓",
  PENDING: "…",
  FAILED: "✗",
};

export function VennParticipantStatus({ participants }: { participants: VennParticipant[] }) {
  const { t } = useLocale();
  if (participants.length === 0) return null;

  const detail = (participant: VennParticipant) => {
    if (participant.status === "FAILED") return participant.error ?? t("venn_participant_failed");
    if (participant.status === "PENDING") return t("venn_participant_fetching");
    return t("venn_participant_done", {
      provider: participant.provider ? PROVIDER_LABELS[participant.provider] : "",
      minutes: participant.durationMinutes ?? "?",
    });
  };

  return (
    <ul className="stack-y-1 text-sm" data-testid="venn-participant-status">
      {participants.map((participant) => (
        <li
          key={participant.contactId}
          data-testid="venn-participant"
          data-status={participant.status}
          className={classNames(
            "flex gap-2",
            participant.status === "FAILED" ? "text-error" : "text-default"
          )}>
          <span aria-hidden="true">{STATUS_GLYPHS[participant.status]}</span>
          <span className="font-medium">{participant.name}</span>
          <span className="text-subtle">—</span>
          <span>{detail(participant)}</span>
        </li>
      ))}
    </ul>
  );
}
