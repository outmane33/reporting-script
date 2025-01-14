// Global variables
const NUMBER_OF_EMAILS = 5;

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Read the file synchronously
const fileContent = fs.readFileSync(
  path.join(__dirname, "OpenEmailsTimes.txt"),
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

const filePath = path.join(__dirname, "emails.txt");
const failedEmailsPath = path.join(__dirname, "failed_moves.txt"); // Added for logging
console.log(`Looking for file at: ${filePath}`);

// Function to log failed email moves (new)
function logFailedEmail(email) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - Failed to move email for account: ${email}\n`;
  fs.appendFileSync(failedEmailsPath, logEntry);
  console.log(`Logged failed email move for: ${email}`);
}

const accounts = fs
  .readFileSync(filePath, "utf-8")
  .split("\n")
  .filter((line) => line.trim());

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processAccounts() {
  try {
    for (const account of accounts) {
      const [email, password] = account.split(":");

      if (!email || !password) {
        console.error(`Invalid account format: ${account}`);
        continue;
      }

      console.log(`Processing account: ${email}`);
      await processAccount(email.trim(), password.trim());
    }
  } catch (error) {
    console.error("Error in main process:", error);
  }
}

async function processAccount(email, password) {
  let browser;
  let verificationBrowser;
  let emailMoved = false; // Added to track email movement

  try {
    browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // Added browser disconnection handler
    browser.on("disconnected", () => {
      if (!emailMoved) {
        console.log(`Browser disconnected before email was moved for ${email}`);
        logFailedEmail(email);
      }
    });

    const page = await browser.newPage();

    await page.goto("https://login.live.com/");
    await page.waitForSelector('input[type="email"]', { visible: true });
    await page.type('input[type="email"]', email);
    await page.click('button[type="submit"]');
    await page.waitForSelector('input[type="password"]', { visible: true });
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle0" });

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

        verificationBrowser = await puppeteer.launch({
          headless: false,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const verificationPage = await verificationBrowser.newPage();
        await verificationPage.goto(
          "https://mailnesia.com/mailbox/tenciseabbe"
        );

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

        if (verificationBrowser) {
          await verificationBrowser.close();
        }

        console.log("Security Code obtained:", securityCode);

        await page.waitForSelector("#iOttText", { visible: true });
        await page.type("#iOttText", securityCode);

        await page.waitForSelector("#iVerifyCodeAction", { visible: true });
        await page.click("#iVerifyCodeAction");

        await new Promise((resolve) => setTimeout(resolve, 5000));
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

        verificationBrowser = await puppeteer.launch({
          headless: false,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const verificationPage = await verificationBrowser.newPage();
        await verificationPage.goto(
          "https://mailnesia.com/mailbox/tenciseabbe"
        );

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

        if (verificationBrowser) {
          await verificationBrowser.close();
        }

        console.log("Security Code obtained:", securityCode);

        await page.waitForSelector("#iOttText", { visible: true });
        await page.type("#iOttText", securityCode);

        await page.waitForSelector("#iVerifyCodeAction", { visible: true });
        await page.click("#iVerifyCodeAction");

        await new Promise((resolve) => setTimeout(resolve, 5000));
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

    await delay(timings.BeforeGoToInboxFolder);

    // Navigate to Inbox Folder
    await page.goto("https://outlook.live.com/mail/0/");

    // Wait for emails to load and open first 3 emails with delay
    await page.waitForSelector(".jGG6V", { visible: true });

    // Get first 3 email elements
    const emails = await page.$$(".jGG6V");

    // Click first 3 emails with delay
    for (let i = 0; i < NUMBER_OF_EMAILS && i < emails.length; i++) {
      await delay(timings.BetweenEmails); // Wait 6 seconds
      await emails[i].click();
      await delay(timings.BetweenEmails);
      // Using nth-of-type to get second a tag
      try {
        //click to an href wait a little and close new page
        const href = await page.evaluate(() => {
          const link = document.querySelector("a:nth-of-type(2)");
          return link ? link.href : null; // Get the href of the second link
        });

        if (href) {
          console.log(`Opening link in a new tab: ${href}`);

          // Open a new tab
          const newTab = await page.browser().newPage();

          // Navigate the new tab to the href
          await newTab.goto(href);

          // Immediately focus back on the original page
          await page.bringToFront();

          // Optionally, wait in the new tab before closing
          await newTab.waitForTimeout(timings.wait_New_Tab_Before_Closing);

          // Close the new tab
          await newTab.close();

          console.log("New tab closed. Current page retained.");
        } else {
          console.log("No href found.");
        }
      } catch (error) {
        console.log("no href found");
      }
      console.log(`Opened email ${i + 1}`);
    }
  } catch (error) {
    console.error(`Error processing account ${email}:`, error);
    if (!emailMoved) {
      logFailedEmail(email); // Log failure if email wasn't moved
    }
  } finally {
    if (browser) {
      await delay(timings.Close_Browser);
      await browser.close();
    }
    if (verificationBrowser && !verificationBrowser.isConnected()) {
      await verificationBrowser.close();
    }
  }
}

processAccounts().catch(console.error);
