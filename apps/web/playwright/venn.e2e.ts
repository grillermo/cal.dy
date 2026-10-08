import prisma from "@calcom/prisma";
import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";

// Runs only with NEXT_PUBLIC_IS_E2E=1 and VENN_FAKE_ADAPTERS=1 on the server so the Calendly and cal.com adapters are faked.
test.describe("venn", () => {
  test("select two contacts, wait for results, pick a slot, land on the booking page", async ({
    page,
    users,
  }) => {
    const user = await users.create();
    await user.apiLogin();
    await page.goto("/settings/my-account/venn-contacts");

    await page.getByTestId("venn-contact-name").fill("Ana");
    await page.getByTestId("venn-contact-email").fill("ana@example.com");
    await page.getByTestId("venn-contact-link").fill("https://calendly.com/ana/60min");
    await page.getByTestId("venn-contact-submit").click();
    await expect(page.getByText("ana@example.com")).toBeVisible();

    await page.getByTestId("venn-contact-name").fill("Bob");
    await page.getByTestId("venn-contact-email").fill("bob@example.com");
    await page.getByTestId("venn-contact-link").fill("https://cal.com/bob/30min");
    await page.getByTestId("venn-contact-submit").click();
    await expect(page.getByText("bob@example.com")).toBeVisible();

    await page.goto("/venn");
    await page.getByTestId("venn-contact-checkbox-ana@example.com").check();
    await page.getByTestId("venn-contact-checkbox-bob@example.com").check();
    await page.getByTestId("venn-find-times").click();
    await expect(page.getByTestId("venn-slot").first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("venn-slot").first().click();
    await page.getByTestId("venn-book").click();
    await expect(page).toHaveURL(/\/booking\//);
  });

  test("shows the failing contact and link when one link is not found", async ({ page, users }) => {
    const user = await users.create();
    await user.apiLogin();

    // Saving a contact validates the link through the adapter, so the broken contact is inserted directly.
    await prisma.vennContact.createMany({
      data: [
        {
          userId: user.id,
          name: "Ana",
          email: "ana@example.com",
          bookingUrl: "https://calendly.com/ana/60min",
          provider: "CALENDLY",
        },
        {
          userId: user.id,
          name: "Carol",
          email: "carol@example.com",
          bookingUrl: "https://calendly.com/missing/event",
          provider: "CALENDLY",
        },
      ],
    });

    await page.goto("/venn");
    await page.getByTestId("venn-contact-checkbox-ana@example.com").check();
    await page.getByTestId("venn-contact-checkbox-carol@example.com").check();
    await page.getByTestId("venn-find-times").click();

    await expect(page.getByTestId("venn-search-failed")).toBeVisible({ timeout: 30_000 });
    const failed = page.locator('[data-testid="venn-participant"][data-status="FAILED"]');
    await expect(failed).toHaveCount(1);
    await expect(failed).toContainText("Carol");
    await expect(failed).toContainText("calendly.com/missing/event");
    await expect(page.getByTestId("venn-slot")).toHaveCount(0);
    await expect(page.getByTestId("venn-book")).toHaveCount(0);
  });
});
