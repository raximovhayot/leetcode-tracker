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

/** Loads the full tracker (phases + their problems) for a single user. */
export async function listTracker(
  databases: Databases,
  userId: string,
): Promise<PhaseWithProblems[]> {
  const [phaseDocs, problemDocs] = await Promise.all([
    databases.listDocuments(databaseId, phasesCollectionId, [
      Query.equal("userId", userId),
      Query.orderAsc("order"),
      Query.limit(200),
    ]),
    databases.listDocuments(databaseId, problemsCollectionId, [
      Query.equal("userId", userId),
      Query.orderAsc("order"),
      Query.limit(500),
    ]),
  ]);

  const phases = phaseDocs.documents.map(mapPhase);
  const problems = problemDocs.documents
    .map(mapProblem)
    // Stable display order: by `order`, then problem number as a tiebreak.
    .sort((a, b) => a.order - b.order || a.number - b.number);

  return phases.map((phase) => ({
    ...phase,
    problems: problems.filter((p) => p.phaseId === phase.$id),
  }));
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
