const axios = require('axios');

// Generate access token
const getAccessToken = async () => {
  const consumer_key = process.env.CONSUMER_KEY || "GTWADFxIpUfDoNikNGqq1C3023evM6UH";
  const consumer_secret = process.env.CONSUMER_SECRET || "amFbAoUByPV2rM5A";
  
  const api_URL = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  
  const response = await axios.get(api_URL, {
    auth: {
      username: consumer_key,
      password: consumer_secret
    }
  });
  
  return response.data.access_token;
};

// Trigger STK Push
const stkPush = async (phone, amount) => {
  const access_token = await getAccessToken();
  
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const passkey = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
  const business_short_code = process.env.BUSINESS_SHORTCODE || "174379";
  
  const data = business_short_code + passkey + timestamp;
  const password = Buffer.from(data).toString('base64');
  
  const payload = {
    BusinessShortCode: business_short_code,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: "1", // Use 1 for testing
    PartyA: phone,
    PartyB: business_short_code,
    PhoneNumber: phone,
    CallBackURL: `${process.env.CALLBACK_URL || 'https://bookhive-backend-zdho.onrender.com'}/api/mpesa/callback`,
    AccountReference: "BookHive Payment",
    TransactionDesc: "Payment for books"
  };
  
  const headers = {
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json"
  };
  
  const url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
  const response = await axios.post(url, payload, { headers });
  
  return response.data;
};

module.exports = { getAccessToken, stkPush };