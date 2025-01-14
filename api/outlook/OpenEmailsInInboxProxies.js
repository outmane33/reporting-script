const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const emailsFilePath = path.join(__dirname, "emails.txt");
const proxiesFilePath = path.join(__dirname, "proxies.txt");

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

const accounts = fs
  .readFileSync(emailsFilePath, "utf-8")
  .split("\n")
  .filter((line) => line.trim());

// Read proxies
const proxies = fs
  .readFileSync(proxiesFilePath, "utf-8")
  .split("\n")
  .filter((line) => line.trim());

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    for (let i = 0; i < 5 && i < emails.length; i++) {
      await delay(timings.BetweenEmails); // Wait 6 seconds
      await emails[i].click();
      console.log(`Opened email ${i + 1}`);
    }
  } catch (error) {
    console.error(
      `Error processing account ${email} with proxy ${proxy}:`,
      error
    );
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
