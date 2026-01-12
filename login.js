const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");

// Aapki Details (Pahle se bhari hui)
const apiId = 34092408;
const apiHash = "13bdb62f6a9424169574109474cd6bde";
const stringSession = new StringSession("");

(async () => {
  console.log("Connecting to Telegram...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Enter your number (+91...): "),
    password: async () => await input.text("Enter your password (if 2FA enabled): "),
    phoneCode: async () => await input.text("Enter the OTP you received: "),
    onError: (err) => console.log(err),
  });

  console.log("\n✅ SESSION STRING (Niche wali lambi line copy karein):\n");
  console.log(client.session.save());
  process.exit(0);
})();

