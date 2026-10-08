"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@calcom/ui/components/button";
import { CheckboxField } from "@calcom/ui/components/form";
import { useState } from "react";
import type { VennContact, VennContactInput } from "../hooks/useVennContacts";
import { VennContactForm } from "./VennContactForm";

type Props = {
  contacts: VennContact[];
  selectedIds: ReadonlySet<number>;
  onToggle: (contactId: number, checked: boolean) => void;
  onAdd: (input: VennContactInput) => Promise<unknown>;
};

export function VennContactPicker({ contacts, selectedIds, onToggle, onAdd }: Props) {
  const { t } = useLocale();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="stack-y-3">
      <p className="font-medium text-emphasis text-sm">{t("venn_select_contacts")}</p>
      {contacts.length === 0 ? <p className="text-sm text-subtle">{t("venn_no_contacts")}</p> : null}
      <div className="stack-y-1">
        {contacts.map((contact) => (
          <CheckboxField
            key={contact.id}
            data-testid={`venn-contact-checkbox-${contact.email}`}
            description={`${contact.name} · ${contact.email}`}
            checked={selectedIds.has(contact.id)}
            onChange={(e) => onToggle(contact.id, e.target.checked)}
          />
        ))}
      </div>
      {showForm ? (
        <VennContactForm onAdd={onAdd} />
      ) : (
        <Button
          color="minimal"
          StartIcon="plus"
          data-testid="venn-show-add-contact"
          onClick={() => setShowForm(true)}>
          {t("venn_add_contact")}
        </Button>
      )}
    </div>
  );
}
