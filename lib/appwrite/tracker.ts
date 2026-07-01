import "server-only";

import {
  type Databases,
  ID,
  type Models,
  Permission,
  Query,
  Role,
} from "node-appwrite";

import type {
  Approach,
  Difficulty,
  Phase,
  PhaseWithProblems,
  Problem,
} from "../types";
import { approachesAllDone } from "../stats";
import { appwriteConfig } from "./config";

const { databaseId, phasesCollectionId, problemsCollectionId } = appwriteConfig;

function ownerPermissions(userId: string): string[] {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function parseApproaches(raw: unknown): Approach[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.name === "string")
      .map((a) => ({ name: String(a.name), done: Boolean(a.done) }));
  } catch {
    return [];
  }
}

/** Appwrite documents are typed without an index signature, so read fields loosely. */
type AnyDoc = Models.Document & Record<string, unknown>;

function mapPhase(input: Models.Document): Phase {
  const doc = input as AnyDoc;
  return {
    $id: doc.$id,
    name: String(doc.name ?? ""),
    order: Number(doc.order ?? 0),
  };
}

function mapProblem(input: Models.Document): Problem {
  const doc = input as AnyDoc;
  return {
    $id: doc.$id,
    number: Number(doc.number ?? 0),
    title: String(doc.title ?? ""),
    url: String(doc.url ?? ""),
    difficulty: (doc.difficulty as Difficulty) ?? "Easy",
    must: Boolean(doc.must),
    solved: Boolean(doc.solved),
    order: Number(doc.order ?? 0),
    phaseId: String(doc.phaseId ?? ""),
    approaches: parseApproaches(doc.approaches),
  };
}

/** Stable display order: by `order`, then problem number as a tiebreak. */
function sortProblems(problems: Problem[]): Problem[] {
  return problems.sort((a, b) => a.order - b.order || a.number - b.number);
}

/** Groups a flat list of problems under their phases, preserving phase order. */
export function groupProblemsByPhase(
  phases: Phase[],
  problems: Problem[],
): PhaseWithProblems[] {
  return phases.map((phase) => ({
    ...phase,
    problems: problems.filter((p) => p.phaseId === phase.$id),
  }));
}

/** Loads the full tracker (phases + their problems) for a single user. */
export async function listTracker(
  databases: Databases,
  userId: string,
): Promise<PhaseWithProblems[]> {
  const [phases, problems] = await Promise.all([
    listPhases(databases, userId),
    listAllProblems(databases, userId),
  ]);
  return groupProblemsByPhase(phases, problems);
}

/** Loads only the phases (categories) owned by the user, in order. */
export async function listPhases(
  databases: Databases,
  userId: string,
): Promise<Phase[]> {
  const docs = await databases.listDocuments(databaseId, phasesCollectionId, [
    Query.equal("userId", userId),
    Query.orderAsc("order"),
    Query.limit(200),
  ]);
  return docs.documents.map(mapPhase);
}

/** Loads every problem owned by the user, in stable display order. */
export async function listAllProblems(
  databases: Databases,
  userId: string,
): Promise<Problem[]> {
  const docs = await databases.listDocuments(databaseId, problemsCollectionId, [
    Query.equal("userId", userId),
    Query.orderAsc("order"),
    Query.limit(500),
  ]);
  return sortProblems(docs.documents.map(mapProblem));
}

/**
 * Loads only the problems whose document id is in `ids`, owned by the user.
 * Used to scope reads to a single timeline instead of the whole collection.
 * Appwrite caps the number of values in an equality filter, so ids are read in
 * batches.
 */
export async function listProblemsByIds(
  databases: Databases,
  userId: string,
  ids: string[],
): Promise<Problem[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const BATCH = 100;
  const batches: Promise<Problem[]>[] = [];
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    batches.push(
      databases
        .listDocuments(databaseId, problemsCollectionId, [
          Query.equal("userId", userId),
          Query.equal("$id", chunk),
          Query.limit(chunk.length),
        ])
        .then((res) => res.documents.map(mapProblem)),
    );
  }

  const results = await Promise.all(batches);
  return sortProblems(results.flat());
}

export type AddPhaseInput = { name: string; order?: number };

export async function addPhase(
  databases: Databases,
  userId: string,
  input: AddPhaseInput,
): Promise<Phase> {
  const doc = await databases.createDocument(
    databaseId,
    phasesCollectionId,
    ID.unique(),
    { name: input.name, order: input.order ?? 0, userId },
    ownerPermissions(userId),
  );
  return mapPhase(doc);
}

export type AddProblemInput = {
  phaseId: string;
  number: number;
  title: string;
  url?: string;
  difficulty?: Difficulty;
  must?: boolean;
  solved?: boolean;
  order?: number;
  approaches?: Approach[];
};

export async function addProblem(
  databases: Databases,
  userId: string,
  input: AddProblemInput,
): Promise<Problem> {
  const doc = await databases.createDocument(
    databaseId,
    problemsCollectionId,
    ID.unique(),
    {
      phaseId: input.phaseId,
      number: input.number,
      title: input.title,
      url: input.url ?? "",
      difficulty: input.difficulty ?? "Easy",
      must: input.must ?? false,
      solved: input.solved ?? false,
      order: input.order ?? 0,
      approaches: JSON.stringify(input.approaches ?? []),
      userId,
    },
    ownerPermissions(userId),
  );
  return mapProblem(doc);
}

/** Fetches one problem owned by the user, or null if not found. */
async function findProblem(
  databases: Databases,
  userId: string,
  problemId: string,
): Promise<Problem | null> {
  try {
    const doc = await databases.getDocument(
      databaseId,
      problemsCollectionId,
      problemId,
    );
    if (String((doc as AnyDoc).userId) !== userId) return null;
    return mapProblem(doc);
  } catch {
    return null;
  }
}

export type UpdateProblemInput = {
  number?: number;
  title?: string;
  url?: string;
  difficulty?: Difficulty;
  phaseId?: string;
  order?: number;
  solved?: boolean;
  must?: boolean;
  approaches?: Approach[];
};

export async function updateProblem(
  databases: Databases,
  userId: string,
  problemId: string,
  patch: UpdateProblemInput,
): Promise<Problem | null> {
  const existing = await findProblem(databases, userId, problemId);
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (patch.number !== undefined) data.number = patch.number;
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.url !== undefined) data.url = patch.url;
  if (patch.difficulty !== undefined) data.difficulty = patch.difficulty;
  if (patch.phaseId !== undefined) data.phaseId = patch.phaseId;
  if (patch.order !== undefined) data.order = patch.order;
  if (patch.solved !== undefined) data.solved = patch.solved;
  if (patch.must !== undefined) data.must = patch.must;
  if (patch.approaches !== undefined) {
    data.approaches = JSON.stringify(patch.approaches);
    // Keep the overall solved flag in sync with the approaches: a problem is
    // fully solved only when every approach is done. An explicit `solved` in the
    // same patch still wins (manual override).
    if (patch.solved === undefined) {
      data.solved = approachesAllDone(patch.approaches);
    }
  }

  const doc = await databases.updateDocument(
    databaseId,
    problemsCollectionId,
    problemId,
    data,
  );
  return mapProblem(doc);
}

/** Toggles a single approach's done flag by approach index. */
export async function setApproachDone(
  databases: Databases,
  userId: string,
  problemId: string,
  approachIndex: number,
  done: boolean,
): Promise<Problem | null> {
  const existing = await findProblem(databases, userId, problemId);
  if (!existing) return null;

  const approaches = existing.approaches.map((a, i) =>
    i === approachIndex ? { ...a, done } : a,
  );
  return updateProblem(databases, userId, problemId, { approaches });
}

/** Deletes a problem owned by the user. Returns true on success. */
export async function deleteProblem(
  databases: Databases,
  userId: string,
  problemId: string,
): Promise<boolean> {
  const existing = await findProblem(databases, userId, problemId);
  if (!existing) return false;

  await databases.deleteDocument(databaseId, problemsCollectionId, problemId);
  return true;
}
