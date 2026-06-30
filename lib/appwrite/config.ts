/**
 * Centralized Appwrite configuration read from environment variables.
 * Public values (NEXT_PUBLIC_*) are safe to expose to the browser.
 * Server-only secrets (API key) must never be imported into client components.
 */

export const appwriteConfig = {
  endpoint:
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "",
  databaseId: process.env.APPWRITE_DATABASE_ID ?? "leetcode",
  phasesCollectionId: process.env.APPWRITE_PHASES_COLLECTION_ID ?? "phases",
  problemsCollectionId:
    process.env.APPWRITE_PROBLEMS_COLLECTION_ID ?? "problems",
  tokensCollectionId: process.env.APPWRITE_TOKENS_COLLECTION_ID ?? "mcp_tokens",
} as const;

/** Server-only secret. Reading this from a client component will return "". */
export const appwriteServerKey = process.env.APPWRITE_API_KEY ?? "";

/** Name of the cookie that stores the Appwrite session secret. */
export const SESSION_COOKIE = "lc_session";
