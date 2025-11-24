const axios = require('axios');

// Generate access token
const getAccessToken = async () => {
  const auth = Buffer.from(
    process.env.CONSUMER_KEY + ":" + process.env.CONSUMER_SECRET
  ).toString("base64");

  const res = await axios.get(
    "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  return res.data.access_token;
};

// Trigger STK Push
const stkPush = async (phone, amount) => {
  const token = await getAccessToken();

  const shortcode = process.env.BUSINESS_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);

  const password = Buffer.from(shortcode + passkey + timestamp).toString(
    "base64"
  );

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: `${process.env.CALLBACK_URL}/api/mpesa/callback`,
    AccountReference: "BookHive Payment",
    TransactionDesc: "Payment for books",
  };

  const res = await axios.post(
    "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data;
};

module.exports = { getAccessToken, stkPush };