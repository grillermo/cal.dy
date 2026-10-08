"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@calcom/ui/components/button";
import { TextField } from "@calcom/ui/components/form";
import type { FormEvent } from "react";
import { useState } from "react";
import type { VennContactInput } from "../hooks/useVennContacts";

type Props = {
  onAdd: (input: VennContactInput) => Promise<unknown>;
};

export function VennContactForm({ onAdd }: Props) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onAdd({ name, email, bookingUrl });
      setName("");
      setEmail("");
      setBookingUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("something_went_wrong"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stack-y-4">
      <TextField
        label={t("venn_contact_name")}
        data-testid="venn-contact-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <TextField
        label={t("venn_contact_email")}
        type="email"
        data-testid="venn-contact-email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <TextField
        label={t("venn_contact_link")}
        hint={t("venn_contact_link_hint")}
        data-testid="venn-contact-link"
        value={bookingUrl}
        onChange={(e) => setBookingUrl(e.target.value)}
        required
      />
      {error ? (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" data-testid="venn-contact-submit" loading={isSubmitting}>
        {t("venn_add_contact")}
      </Button>
    </form>
  );
}
