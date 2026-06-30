import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { ID, Permission, Query, Role } from "node-appwrite";

import { verifyAccessToken } from "../mcp/oauth";
import { appwriteConfig } from "./config";
import { createAdminClient } from "./server";

const { databaseId, tokensCollectionId } = appwriteConfig;

/** Tokens are stored hashed so a database leak does not expose live secrets. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Resolves a bearer token to its owner's userId, or null if unknown.
 * Used by the MCP endpoint to scope every operation to a single user.
 */
export async function resolveTokenUserId(
  token: string,
): Promise<string | null> {
  if (!token) return null;

  // OAuth 2.1 access tokens are self-contained and verified without a DB call.
  const oauthUserId = verifyAccessToken(token);
  if (oauthUserId) return oauthUserId;

  // Fall back to legacy personal bearer tokens stored hashed in the database.
  const { databases } = createAdminClient();
  try {
    const res = await databases.listDocuments(databaseId, tokensCollectionId, [
      Query.equal("tokenHash", hashToken(token)),
      Query.limit(1),
    ]);
    const doc = res.documents[0] as (typeof res.documents)[0] &
      Record<string, unknown>;
    return doc ? String(doc.userId) : null;
  } catch {
    return null;
  }
}

/** A safe, non-secret summary of a stored MCP token. */
export type McpTokenSummary = {
  id: string;
  label: string;
  createdAt: string;
};

/** Lists the MCP tokens owned by a user, without exposing any secret. */
export async function listMcpTokens(
  userId: string,
): Promise<McpTokenSummary[]> {
  const { databases } = createAdminClient();
  try {
    const res = await databases.listDocuments(databaseId, tokensCollectionId, [
      Query.equal("userId", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]);
    return res.documents.map((doc) => ({
      id: String(doc.$id),
      label: String((doc as Record<string, unknown>).label ?? "default"),
      createdAt: String(doc.$createdAt),
    }));
  } catch {
    return [];
  }
}

/**
 * Revokes (deletes) an MCP token, but only if it belongs to the given user.
 * Returns true when a token was removed.
 */
export async function deleteMcpToken(
  userId: string,
  tokenId: string,
): Promise<boolean> {
  const { databases } = createAdminClient();
  try {
    const doc = await databases.getDocument(
      databaseId,
      tokensCollectionId,
      tokenId,
    );
    if (String((doc as Record<string, unknown>).userId) !== userId) {
      return false;
    }
    await databases.deleteDocument(databaseId, tokensCollectionId, tokenId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Issues a new MCP token for a user and stores only its hash.
 * Returns the plaintext token once — it cannot be recovered later.
 */
export async function createMcpToken(
  userId: string,
  label: string,
): Promise<string> {
  const token = `lct_${randomBytes(24).toString("hex")}`;
  const { databases } = createAdminClient();
  await databases.createDocument(
    databaseId,
    tokensCollectionId,
    ID.unique(),
    {
      tokenHash: hashToken(token),
      userId,
      label: label || "default",
    },
    [
      Permission.read(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ],
  );
  return token;
}
