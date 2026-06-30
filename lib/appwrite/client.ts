"use client";

import { Account, Client, OAuthProvider } from "appwrite";

import { appwriteConfig } from "./config";

/** Browser-side Appwrite client. Only public config is used here. */
export function createBrowserClient() {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId);

  return {
    client,
    account: new Account(client),
  };
}

export { OAuthProvider };
