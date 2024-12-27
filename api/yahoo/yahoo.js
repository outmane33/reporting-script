const fs = require("fs");
const Imap = require("imap-simple");
const path = require("path");

const filePath = path.join(__dirname, "yahoo_accounts.txt"); // Automatically resolves the file path
console.log(`Looking for file at: ${filePath}`);

// Read the file and split it into lines
const accounts = fs.readFileSync(filePath, "utf-8").split("\n");

accounts.forEach((account, index) => {
  const [email, password] = account.split(":"); // Extract email and password from each line

  if (!email || !password) {
    console.error(`Invalid account format on line ${index + 1}: ${account}`);
    return;
  }

  const config = {
    imap: {
      user: email,
      password: password,
      host: "imap.mail.yahoo.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 3000,
    },
  };

  Imap.connect(config)
    .then((connection) => {
      console.log(`Connected to: ${email}`);

      return connection.openBox("Bulk").then(() => {
        const searchCriteria = ["ALL"];
        const fetchOptions = {
          bodies: ["HEADER"],
          markSeen: false,
        };

        return connection
          .search(searchCriteria, fetchOptions)
          .then((messages) => {
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
              return (
                subject === "6 More Days to Make a Difference" &&
                from.includes("hello@housingworks.org")
              );
            });

            if (!targetMessage) {
              console.log(`No matching message found for ${email}.`);
              connection.end();
              return;
            }

            const uid = targetMessage.attributes.uid;
            console.log(
              `Moving message with UID: ${uid} for ${email} to Inbox...`
            );

            connection
              .moveMessage(uid, "INBOX")
              .then(() => {
                console.log(
                  `Message successfully moved to Inbox for ${email}.`
                );
                connection.end();
              })
              .catch((err) => {
                console.error(`Error moving message for ${email}:`, err);
                connection.end();
              });
          });
      });
    })
    .catch((err) => {
      console.error(`Failed to connect for ${email}:`, err);
    });

  //   Imap.connect(config)
  //     .then((connection) => {
  //       console.log(`Connected to: ${email}`);

  //       // Fetch and display the list of available folders
  //       connection.getBoxes().then((mailboxes) => {
  //         console.log(`Available folders for ${email}:`, mailboxes);
  //       });
  //     })
  //     .catch((err) => {
  //       console.error(`Failed to connect for ${email}:`, err);
  //     });
});
