import "server-only";

import {
  type Databases,
  ID,
  type Models,
  Permission,
  Query,
  Role,
} from "node-appwrite";

import type { Problem, Timeline, TimelineWithProblems } from "../types";
import { appwriteConfig } from "./config";
import { listAllProblems } from "./tracker";

const { databaseId, timelinesCollectionId } = appwriteConfig;

function ownerPermissions(userId: string): string[] {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function parseProblemIds(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string");
  } catch {
    return [];
  }
}

/** Appwrite documents are typed without an index signature, so read fields loosely. */
type AnyDoc = Models.Document & Record<string, unknown>;

function mapTimeline(input: Models.Document): Timeline {
  const doc = input as AnyDoc;
  return {
    $id: doc.$id,
    name: String(doc.name ?? ""),
    startAt: String(doc.startAt ?? ""),
    endAt: String(doc.endAt ?? ""),
    order: Number(doc.order ?? 0),
    problemIds: parseProblemIds(doc.problemIds),
  };
}

/**
 * Loads every timeline for a user, each joined with its resolved problems.
 * Problems are fetched once and matched in memory to keep Appwrite reads low.
 *
 * When the caller already has the user's problems loaded (e.g. the home page
 * fetches them via {@link listTracker}), pass them in as `knownProblems` to
 * avoid a second read of the whole problems collection.
 */
export async function listTimelines(
  databases: Databases,
  userId: string,
  knownProblems?: Problem[],
): Promise<TimelineWithProblems[]> {
  const [timelineDocs, problems] = await Promise.all([
    databases.listDocuments(databaseId, timelinesCollectionId, [
      Query.equal("userId", userId),
      Query.orderAsc("order"),
      Query.limit(200),
    ]),
    knownProblems ?? listAllProblems(databases, userId),
  ]);

  const byId = new Map(problems.map((p) => [p.$id, p]));

  return timelineDocs.documents.map(mapTimeline).map((timeline) => ({
    ...timeline,
    // Preserve the stored order of ids and drop any that no longer exist.
    problems: timeline.problemIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p)),
  }));
}

/**
 * Loads the user's timelines without joining their problems. Use this when only
 * timeline metadata (dates, name, problem ids) is needed, so no read of the
 * problems collection is issued.
 */
export async function listTimelinesMeta(
  databases: Databases,
  userId: string,
): Promise<Timeline[]> {
  const docs = await databases.listDocuments(
    databaseId,
    timelinesCollectionId,
    [
      Query.equal("userId", userId),
      Query.orderAsc("order"),
      Query.limit(200),
    ],
  );
  return docs.documents.map(mapTimeline);
}

export type AddTimelineInput = {
  name: string;
  startAt?: string;
  endAt?: string;
  order?: number;
  problemIds?: string[];
};

export async function addTimeline(
  databases: Databases,
  userId: string,
  input: AddTimelineInput,
): Promise<Timeline> {
  const doc = await databases.createDocument(
    databaseId,
    timelinesCollectionId,
    ID.unique(),
    {
      name: input.name,
      startAt: input.startAt ?? "",
      endAt: input.endAt ?? "",
      order: input.order ?? 0,
      problemIds: JSON.stringify(input.problemIds ?? []),
      userId,
    },
    ownerPermissions(userId),
  );
  return mapTimeline(doc);
}

/** Fetches one timeline owned by the user, or null if not found. */
async function findTimeline(
  databases: Databases,
  userId: string,
  timelineId: string,
): Promise<Timeline | null> {
  try {
    const doc = await databases.getDocument(
      databaseId,
      timelinesCollectionId,
      timelineId,
    );
    if (String((doc as AnyDoc).userId) !== userId) return null;
    return mapTimeline(doc);
  } catch {
    return null;
  }
}

export type UpdateTimelineInput = {
  name?: string;
  startAt?: string;
  endAt?: string;
  order?: number;
  problemIds?: string[];
};

export async function updateTimeline(
  databases: Databases,
  userId: string,
  timelineId: string,
  patch: UpdateTimelineInput,
): Promise<Timeline | null> {
  const existing = await findTimeline(databases, userId, timelineId);
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.startAt !== undefined) data.startAt = patch.startAt;
  if (patch.endAt !== undefined) data.endAt = patch.endAt;
  if (patch.order !== undefined) data.order = patch.order;
  if (patch.problemIds !== undefined) {
    data.problemIds = JSON.stringify(patch.problemIds);
  }

  const doc = await databases.updateDocument(
    databaseId,
    timelinesCollectionId,
    timelineId,
    data,
  );
  return mapTimeline(doc);
}

/** Deletes a timeline owned by the user. Returns true on success. */
export async function deleteTimeline(
  databases: Databases,
  userId: string,
  timelineId: string,
): Promise<boolean> {
  const existing = await findTimeline(databases, userId, timelineId);
  if (!existing) return false;

  await databases.deleteDocument(
    databaseId,
    timelinesCollectionId,
    timelineId,
  );
  return true;
}
