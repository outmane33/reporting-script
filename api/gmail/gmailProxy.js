const fs = require("fs");
const Imap = require("imap-simple");
const { SocksProxyAgent } = require("socks-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const path = require("path");

// Paths to files
const accountsFilePath = path.join(__dirname, "gmail_accounts.txt");
const proxiesFilePath = path.join(__dirname, "proxies.txt");
const errorLogPath = path.join(__dirname, "errors.txt");

console.log(`Looking for accounts file at: ${accountsFilePath}`);
console.log(`Looking for proxies file at: ${proxiesFilePath}`);

// Read accounts and proxies from files
const accounts = fs.readFileSync(accountsFilePath, "utf-8").trim().split("\n");
const proxyUrls = fs.readFileSync(proxiesFilePath, "utf-8").trim().split("\n");

// Ensure the number of accounts matches the number of proxies
if (accounts.length !== proxyUrls.length) {
  console.error("Error: The number of accounts and proxies must match.");
  process.exit(1);
}

// Function to log errors to a file
const logError = (account, reason) => {
  const errorLine = `${account} - ${reason}\n`;
  fs.appendFileSync(errorLogPath, errorLine, "utf-8");
  console.error(`Logged error for account: ${account}`);
};

// Helper function to process one account at a time
const processAccount = async (account, proxy) => {
  const [email, password] = account.split(":");

  if (!email || !password) {
    const reason = "Invalid account format";
    console.error(`${reason}: ${account}`);
    logError(account, reason);
    return;
  }

  if (!proxy) {
    const reason = "No proxy found";
    console.error(`${reason} for account: ${email}`);
    logError(account, reason);
    return;
  }

  // Select the appropriate agent based on the proxy protocol
  let agent;
  if (proxy.startsWith("socks")) {
    agent = new SocksProxyAgent(proxy);
  } else if (proxy.startsWith("http")) {
    agent = new HttpsProxyAgent(proxy);
  } else {
    const reason = `Unsupported proxy protocol for ${proxy}`;
    console.error(reason);
    logError(account, reason);
    return;
  }

  const config = {
    imap: {
      user: email,
      password,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 3000,
      agent, // Use the selected proxy agent
    },
  };

  try {
    const connection = await Imap.connect(config);
    console.log(`Connected to: ${email} via proxy ${proxy}`);

    await connection.openBox("[Gmail]/Spam");

    const searchCriteria = ["ALL"];
    const fetchOptions = {
      bodies: ["HEADER"],
      markSeen: false,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    if (messages.length === 0) {
      console.log(`No messages found in Spam folder for ${email}.`);
      connection.end();
      return;
    }

    const targetMessage = messages.find((message) => {
      const headers = message.parts.find(
        (part) => part.which === "HEADER"
      ).body;
      const subject = headers.subject ? headers.subject[0] : "";
      const from = headers.from ? headers.from[0] : "";
      return subject === "hello world"; // Update your search logic
    });

    if (!targetMessage) {
      console.log(`No matching message found for ${email}.`);
      connection.end();
      return;
    }

    const uid = targetMessage.attributes.uid;
    console.log(`Moving message with UID: ${uid} for ${email} to Inbox...`);

    await connection.moveMessage(uid, "INBOX");
    console.log(`Message successfully moved to Inbox for ${email}.`);
    connection.end();
  } catch (err) {
    const reason = `Connection or processing error: ${err.message}`;
    console.error(`Failed to process ${email} via proxy ${proxy}:`, err);
    logError(account, reason);
  }
};

// Sequentially process accounts and proxies
const processAllAccounts = async () => {
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const proxy = proxyUrls[i];
    console.log(`Processing account ${i + 1} of ${accounts.length}...`);
    await processAccount(account, proxy);
  }
};

processAllAccounts().then(() => {
  console.log("All accounts processed.");
});
