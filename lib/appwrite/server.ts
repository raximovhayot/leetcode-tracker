import "server-only";

import { cookies } from "next/headers";
import { Account, Client, Databases, type Models } from "node-appwrite";

import { appwriteConfig, appwriteServerKey, SESSION_COOKIE } from "./config";

/**
 * Admin client backed by the server API key. Bypasses user permissions, so use
 * only on the server for trusted operations (OAuth session creation, MCP writes).
 */
export function createAdminClient() {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId)
    .setKey(appwriteServerKey);

  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
  };
}

/**
 * Per-request client scoped to the logged-in user's session cookie. All reads
 * and writes are subject to that user's document permissions.
 */
export async function createSessionClient() {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId);

  const session = (await cookies()).get(SESSION_COOKIE);
  if (session?.value) {
    client.setSession(session.value);
  }

  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
  };
}

/** Returns the current user, or null when not authenticated. */
export async function getLoggedInUser(): Promise<Models.User<Models.Preferences> | null> {
  try {
    const { account } = await createSessionClient();
    return await account.get();
  } catch {
    return null;
  }
}
