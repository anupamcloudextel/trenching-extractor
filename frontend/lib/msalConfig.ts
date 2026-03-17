/**
 * MSAL config for Azure AD. Uses 10.28.30.56; in browser uses current origin when different.
 */
const redirectUri =
  typeof window !== "undefined" ? `${window.location.origin}/` : "https://10.28.30.56/";

export const msalConfig = {
  auth: {
    clientId: "8a1b3f20-6cc1-4bd3-b53b-81ac2cf0fdd5",
    authority: "https://login.microsoftonline.com/28ca66c4-1213-4649-b4e6-599b5f207a74",
    redirectUri,
  },
  cache: {
    cacheLocation: "localStorage" as const,
    storeAuthStateInCookie: true,
  },
};

export const loginRequest = {
  scopes: ["user.read", "mail.readwrite"],
};
