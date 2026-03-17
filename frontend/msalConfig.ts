import { Configuration } from "@azure/msal-browser";

// Refactor to use environment variables for sensitive config
const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!, // Set in .env
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID}`,
    redirectUri: process.env.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI || "https://10.28.30.56/",
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

export default msalConfig;

export const loginRequest = {
  scopes: ["user.read", "mail.readwrite"],
};
