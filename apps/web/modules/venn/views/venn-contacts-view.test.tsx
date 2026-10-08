import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VennContactsView from "./venn-contacts-view";

const add = vi.fn();
const remove = vi.fn();
let contacts: { id: number; name: string; email: string; bookingUrl: string; provider: string }[] = [];

vi.mock("../hooks/useVennContacts", () => ({
  useVennContacts: () => ({ contacts, add, remove, update: vi.fn(), isLoading: false }),
}));

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

vi.mock("@calcom/features/settings/appDir/SettingsHeader", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("VennContactsView", () => {
  beforeEach(() => {
    add.mockReset();
    remove.mockReset();
    contacts = [];
  });

  it("shows the empty state", () => {
    render(<VennContactsView />);
    expect(screen.getByText("venn_no_contacts")).toBeInTheDocument();
  });

  it("lists contacts with name, email and provider", () => {
    contacts = [
      {
        id: 1,
        name: "Ada",
        email: "ada@example.com",
        bookingUrl: "https://calendly.com/a/b",
        provider: "CALENDLY",
      },
    ];
    render(<VennContactsView />);
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/CALENDLY/)).toBeInTheDocument();
    expect(screen.queryByText("venn_no_contacts")).not.toBeInTheDocument();
  });

  it("submits the add form with the three fields", async () => {
    add.mockResolvedValue({});
    render(<VennContactsView />);
    fireEvent.change(screen.getByTestId("venn-contact-name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByTestId("venn-contact-email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByTestId("venn-contact-link"), {
      target: { value: "https://calendly.com/a/b" },
    });
    fireEvent.click(screen.getByTestId("venn-contact-submit"));
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({
        name: "Ada",
        email: "ada@example.com",
        bookingUrl: "https://calendly.com/a/b",
      })
    );
  });

  it("shows the server message when add rejects", async () => {
    add.mockRejectedValue(new Error("Unsupported booking link: https://example.org/x/y"));
    render(<VennContactsView />);
    fireEvent.change(screen.getByTestId("venn-contact-name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByTestId("venn-contact-email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByTestId("venn-contact-link"), {
      target: { value: "https://example.org/x/y" },
    });
    fireEvent.click(screen.getByTestId("venn-contact-submit"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unsupported booking link: https://example.org/x/y"
    );
  });

  const ada = {
    id: 7,
    name: "Ada",
    email: "ada@example.com",
    bookingUrl: "https://calendly.com/a/b",
    provider: "CALENDLY",
  };

  it("disables the delete button while the removal is pending", async () => {
    contacts = [ada];
    let resolve: () => void = () => {};
    remove.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    render(<VennContactsView />);
    const button = screen.getByRole("button", { name: "delete" });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.click(button);
    expect(remove).toHaveBeenCalledTimes(1);
    resolve();
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("shows the server message inline when removal fails", async () => {
    contacts = [ada];
    remove.mockRejectedValue(new Error("Contact not found"));
    render(<VennContactsView />);
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(await screen.findByTestId("venn-contact-remove-error")).toHaveTextContent("Contact not found");
    expect(screen.getByRole("button", { name: "delete" })).not.toBeDisabled();
  });

  it("removes a contact", () => {
    contacts = [
      {
        id: 7,
        name: "Ada",
        email: "ada@example.com",
        bookingUrl: "https://calendly.com/a/b",
        provider: "CALENDLY",
      },
    ];
    remove.mockResolvedValue({});
    render(<VennContactsView />);
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(remove).toHaveBeenCalledWith({ id: 7 });
  });
});
