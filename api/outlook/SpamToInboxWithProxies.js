// Global variables
const TARGET_EMAIL = "royj.floressdcds@gmail.com";
const TARGET_SUBJECT = "test2";

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const emailsFilePath = path.join(__dirname, "emails.txt");
const proxiesFilePath = path.join(__dirname, "proxies.txt");

// Read the file synchronously
const fileContent = fs.readFileSync(
  path.join(__dirname, "SpamToInboxTimes.txt"),
  "utf8"
);

// Split the content by new lines and create an object
const timings = {};
fileContent.split("\n").forEach((line) => {
  if (line.trim()) {
    const [key, value] = line.split("=");
    timings[key.trim()] = parseInt(value);
  }
});

console.log(timings);

// Read email accounts
const accounts = fs
  .readFileSync(emailsFilePath, "utf-8")
  .split("\n")
  .filter((line) => line.trim());

// Read proxies
const proxies = fs
  .readFileSync(proxiesFilePath, "utf-8")
  .split("\n")
  .filter((line) => line.trim());

// Helper function to add a delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Main async function to process accounts
async function processAccounts() {
  if (proxies.length < accounts.length) {
    console.error(
      "Not enough proxies! Please ensure the number of proxies matches the number of accounts."
    );
    return;
  }

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const proxy = proxies[i];

    const [email, password] = account.split(":");
    if (!email || !password) {
      console.error(`Invalid account format: ${account}`);
      continue;
    }

    console.log(`Processing account: ${email} with proxy: ${proxy}`);
    await processAccount(email.trim(), password.trim(), proxy.trim());
  }
}

// Main verification function update
async function processAccount(email, password, proxy) {
  let browser;
  let verificationBrowser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      args: [
        `--proxy-server=${proxy}`, // Assign proxy to the browser
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });

    const page = await browser.newPage();

    // Login process
    await page.goto("https://login.live.com/");
    await page.waitForSelector('input[type="email"]', { visible: true });
    await page.type('input[type="email"]', email);
    await page.click('button[type="submit"]');
    await page.waitForSelector('input[type="password"]', { visible: true });
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle0" });

    // Handle 'Stay signed in?' prompt
    try {
      await page.waitForSelector("#acceptButton", {
        visible: true,
        timeout: timings.Stay_signed,
      });
      await page.click("#acceptButton");
    } catch (error) {
      console.log(
        "No 'Stay signed in?' prompt found, proceeding with verification..."
      );

      let inputEmail = email.split("@")[0];
      try {
        await page.waitForSelector('input[type="email"]', {
          visible: true,
          timeout: timings.Write_email,
        });
        await page.type('input[type="email"]', inputEmail);

        await page.waitForSelector(
          'input[type="submit"][id="iSelectProofAction"]',
          { visible: true }
        );
        await page.click('input[type="submit"][id="iSelectProofAction"]');

        // Open verification browser
        verificationBrowser = await puppeteer.launch({
          headless: false,
          args: [
            `--proxy-server=${proxy}`, // Same proxy for verification browser
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
        });

        const verificationPage = await verificationBrowser.newPage();
        await verificationPage.goto(
          "https://mailnesia.com/mailbox/tenciseabbe"
        );

        // Get security code using Promise
        let securityCode = await new Promise(async (resolve, reject) => {
          setTimeout(async () => {
            try {
              await verificationPage.waitForSelector("#mailbox", {
                visible: true,
              });
              await verificationPage.click("#mailbox");
              await verificationPage.evaluate(() => {
                document.querySelector("#mailbox").value = "";
              });

              await verificationPage.type("#mailbox", inputEmail);
              await verificationPage.waitForSelector("#sm", { visible: true });
              await verificationPage.keyboard.press("Enter");

              // Wait for email and extract code
              await verificationPage.waitForSelector(".emailheader", {
                visible: true,
              });
              await new Promise((r) => setTimeout(r, 2000));
              await verificationPage.click(".emailheader");
              await new Promise((r) => setTimeout(r, 2000));

              const code = await verificationPage.evaluate(() => {
                const tdElement = document.querySelector('td[id="i4"]');
                if (!tdElement) return null;
                const spanElement = tdElement.querySelector("span");
                if (!spanElement) return null;
                return spanElement.textContent.trim();
              });

              if (!code) {
                reject(new Error("Failed to extract security code"));
                return;
              }

              resolve(code);
            } catch (error) {
              reject(error);
            }
          }, timings.Move_toInbox);
        });

        // Close verification browser after getting the code
        if (verificationBrowser) {
          await verificationBrowser.close();
        }

        console.log("Security Code obtained:", securityCode);

        // Handle the confirmation page with the security code
        await page.waitForSelector("#iOttText", { visible: true });
        await page.type("#iOttText", securityCode);

        await page.waitForSelector("#iVerifyCodeAction", { visible: true });
        await page.click("#iVerifyCodeAction");

        // Wait for verification to complete
        await new Promise((resolve) =>
          setTimeout(resolve, timings.Stay_signed)
        );
      } catch (verificationError) {
        console.error("Error during verification process:", verificationError);
      }
      try {
        await page.waitForSelector('input[type="email"]', {
          visible: true,
          timeout: timings.Write_email,
        });
        await page.type('input[type="email"]', inputEmail);

        await page.waitForSelector(
          'input[type="submit"][id="iSelectProofAction"]',
          { visible: true }
        );
        await page.click('input[type="submit"][id="iSelectProofAction"]');

        // Open verification browser
        verificationBrowser = await puppeteer.launch({
          headless: false,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const verificationPage = await verificationBrowser.newPage();
        await verificationPage.goto(
          "https://mailnesia.com/mailbox/tenciseabbe"
        );

        // Get security code using Promise
        let securityCode = await new Promise(async (resolve, reject) => {
          setTimeout(async () => {
            try {
              await verificationPage.waitForSelector("#mailbox", {
                visible: true,
              });
              await verificationPage.click("#mailbox");
              await verificationPage.evaluate(() => {
                document.querySelector("#mailbox").value = "";
              });

              await verificationPage.type("#mailbox", inputEmail);
              await verificationPage.waitForSelector("#sm", { visible: true });
              await verificationPage.keyboard.press("Enter");

              // Wait for email and extract code
              await verificationPage.waitForSelector(".emailheader", {
                visible: true,
              });
              await new Promise((r) => setTimeout(r, 2000));
              await verificationPage.click(".emailheader");
              await new Promise((r) => setTimeout(r, 2000));

              const code = await verificationPage.evaluate(() => {
                const tdElement = document.querySelector('td[id="i4"]');
                if (!tdElement) return null;
                const spanElement = tdElement.querySelector("span");
                if (!spanElement) return null;
                return spanElement.textContent.trim();
              });

              if (!code) {
                reject(new Error("Failed to extract security code"));
                return;
              }

              resolve(code);
            } catch (error) {
              reject(error);
            }
          }, timings.Move_toInbox);
        });

        // Close verification browser after getting the code
        if (verificationBrowser) {
          await verificationBrowser.close();
        }

        console.log("Security Code obtained:", securityCode);

        // Handle the confirmation page with the security code
        await page.waitForSelector("#iOttText", { visible: true });
        await page.type("#iOttText", securityCode);

        await page.waitForSelector("#iVerifyCodeAction", { visible: true });
        await page.click("#iVerifyCodeAction");

        // Wait for verification to complete
        await new Promise((resolve) =>
          setTimeout(resolve, timings.Stay_signed)
        );
      } catch (verificationError) {
        console.error("Error during verification process:", verificationError);
      }
      try {
        await page.waitForSelector("#iNext", {
          visible: true,
          timeout: timings.Next,
        });
        await page.click("#iNext");
      } catch (error) {
        console.log("Error during verification process:", error);
      }
      try {
        await page.waitForSelector("#acceptButton", {
          visible: true,
          timeout: timings.Stay_signed,
        });
        await page.click("#acceptButton");
      } catch (error) {
        console.log("Error during verification process:", error);
      }
    }

    // Wait for 3 seconds before navigating to the spam page
    await delay(timings.BeforeGoToSpamFolder);

    // Navigate to spam folder and process emails
    await page.goto("https://outlook.live.com/mail/0/junkemail");

    await page.waitForSelector('div[role="option"]', {
      visible: true,
      timeout: timings.Before_Select_email,
    });

    // Process target email
    const emailFound = await page.evaluate(
      (TARGET_EMAIL, emailDetails) => {
        const rows = Array.from(
          document.querySelectorAll('div[role="option"]')
        );
        for (const row of rows) {
          const fromElement = row.querySelector(
            `span[title="${TARGET_EMAIL}"]`
          );
          const subjectElement = row.querySelector(".TtcXM");

          if (
            fromElement &&
            subjectElement &&
            subjectElement.textContent.trim() === emailDetails.subject
          ) {
            const checkbox = row.querySelector('div[role="checkbox"]');
            if (checkbox) {
              checkbox.click();
              return true;
            }
          }
        }
        return false;
      },
      TARGET_EMAIL,
      { subject: TARGET_SUBJECT }
    );

    if (!emailFound) {
      throw new Error("Target email not found");
    }
    console.log("Selected target email");

    // Move email to inbox
    await delay(timings.After_Select_email);
    await page.waitForSelector('button[id="540"]', { visible: true });
    await page.click('button[id="540"]');

    await page.waitForSelector('input[id="689_moveToMenu_SearchBox"]', {
      visible: true,
    });
    await page.type(
      'input[id="689_moveToMenu_SearchBox"]',
      "Boîte de réception"
    );

    await page.waitForSelector(
      'button[name="Boîte de réception"][role="menuitem"]',
      { visible: true }
    );
    const inboxButton = await page.$(
      'button[name="Boîte de réception"][role="menuitem"]'
    );
    if (!inboxButton) {
      throw new Error("Inbox button not found");
    }
    await inboxButton.click();

    // Handle confirmation dialog
    await delay(timings.Wait_Dialog_Confirm);
    await page.waitForSelector('div[role="dialog"]', { visible: true });

    const dialogResult = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) return false;

      const okButton = Array.from(dialog.querySelectorAll("button")).find(
        (button) => button.textContent.trim().toLowerCase() === "ok"
      );

      if (okButton) {
        okButton.click();
        return true;
      }
      return false;
    });

    if (!dialogResult) {
      throw new Error("Failed to handle confirmation dialog");
    }

    console.log("Email moved to inbox successfully");
  } catch (error) {
    console.error(
      `Error processing account ${email} with proxy ${proxy}:`,
      error
    );
  } finally {
    if (browser) {
      await delay(timings.Close_Browser);
      // await browser.close();
    }
    if (verificationBrowser && !verificationBrowser.isConnected()) {
      await verificationBrowser.close();
    }
  }
}

// Start the process
processAccounts().catch(console.error);
