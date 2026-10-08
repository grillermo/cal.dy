"use client";

import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@calcom/ui/components/button";
import { useState } from "react";
import { VennContactForm } from "../components/VennContactForm";
import { useVennContacts } from "../hooks/useVennContacts";

export default function VennContactsView() {
  const { t } = useLocale();
  const { contacts, add, remove, isLoading } = useVennContacts();
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const handleRemove = async (id: number) => {
    setRemovingId(id);
    setRemoveError(null);
    try {
      await remove({ id });
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : String(error));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <SettingsHeader
      title={t("venn_contacts")}
      description={t("venn_contacts_description")}
      borderInShellHeader={true}>
      <div className="border-subtle stack-y-6 rounded-b-xl border border-t-0 px-4 py-8 sm:px-6">
        {!isLoading && contacts.length === 0 ? (
          <p className="text-subtle text-sm" data-testid="venn-no-contacts">
            {t("venn_no_contacts")}
          </p>
        ) : null}
        <ul className="divide-subtle divide-y">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              data-testid="venn-contact-row"
              className="flex items-center justify-between py-3">
              <div>
                <p className="text-emphasis text-sm font-medium">{contact.name}</p>
                <p className="text-subtle text-sm">
                  {contact.email} · {contact.provider}
                </p>
              </div>
              <Button
                color="destructive"
                variant="icon"
                StartIcon="trash"
                aria-label={t("delete")}
                loading={removingId === contact.id}
                disabled={removingId !== null}
                onClick={() => void handleRemove(contact.id)}
              />
            </li>
          ))}
        </ul>
        {removeError ? (
          <p role="alert" className="text-error text-sm" data-testid="venn-contact-remove-error">
            {removeError}
          </p>
        ) : null}
        <VennContactForm onAdd={add} />
      </div>
    </SettingsHeader>
  );
}
