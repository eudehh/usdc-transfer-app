import { test, expect } from "@playwright/test";

// A fake connected account (checksum-ish placeholder — used only for the demo).
const ACCOUNT = "0x1A2b3C4d5E6f7a8B9c0D1e2F3a4B5c6D7e8F9012";

test("USDC wallet — connect, send form, receive & copy", async ({ page }) => {
  // 1) Mock the JSON-RPC endpoint so the balance balloon shows a real number
  //    instead of hitting the network for a made-up account.
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      try {
        const json = JSON.parse(req.postData() || "{}");
        const reply = (result: unknown) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ id: json.id, jsonrpc: "2.0", result }),
          });
        if (json.method === "eth_call") {
          // balanceOf() -> 1,234.56 USDC (6 decimals)
          return reply("0x" + (1_234_560_000).toString(16).padStart(64, "0"));
        }
        if (json.method === "eth_chainId") return reply("0xaa36a7"); // Sepolia
      } catch {
        /* fall through */
      }
    }
    return route.continue();
  });

  // 2) Inject a fake MetaMask-style provider before the app loads.
  //    Stateful: not connected until the user clicks "CONNECT WALLET".
  await page.addInitScript((account) => {
    let accounts: string[] = [];
    (window as unknown as { ethereum: unknown }).ethereum = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        switch (method) {
          case "eth_accounts":
            return accounts; // empty until connected
          case "eth_requestAccounts":
            accounts = [account];
            return accounts;
          case "eth_chainId":
            return "0xaa36a7"; // Sepolia
          case "eth_sendTransaction":
            return "0x" + "a1b2c3d4".repeat(8);
          case "eth_estimateGas":
            return "0x5208";
          case "eth_getTransactionCount":
            return "0x0";
          case "eth_gasPrice":
            return "0x3b9aca00";
          default:
            return null;
        }
      },
      on: () => {},
      removeListener: () => {},
    };
  }, ACCOUNT);

  await page.goto("/");
  await page.waitForTimeout(900);

  // Connect the wallet — balance balloon appears
  await page.getByRole("button", { name: "CONNECT WALLET" }).click();
  await expect(page.getByText("YOUR BALANCE")).toBeVisible();
  await expect(page.getByText("1,234.56 USDC")).toBeVisible();
  await page.waitForTimeout(1400);

  // Show the Receive tab and copy the address
  await page.getByRole("button", { name: "RECEIVE" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "COPY ADDRESS" }).click();
  await expect(page.getByRole("button", { name: "COPIED!" })).toBeVisible();
  await page.waitForTimeout(1200);

  // Back to Send, fill the form on the fresh panel, then send
  await page.getByRole("button", { name: "SEND", exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByPlaceholder("0x...").fill("0x000000000000000000000000000000000000dEaD");
  await page.waitForTimeout(500);
  await page.getByPlaceholder("10").fill("25");
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "SEND USDC" }).click();
  await expect(page.getByText("WAITING FOR CONFIRMATION")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1800);
});
