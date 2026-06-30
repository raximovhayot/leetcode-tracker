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
    difficulty: (doc.difficulty as Difficulty) ?? "Easy",
    must: Boolean(doc.must),
    solved: Boolean(doc.solved),
    session: String(doc.session ?? ""),
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
  const problems = problemDocs.documents.map(mapProblem);

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
  difficulty?: Difficulty;
  must?: boolean;
  solved?: boolean;
  session?: string;
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
      difficulty: input.difficulty ?? "Easy",
      must: input.must ?? false,
      solved: input.solved ?? false,
      session: input.session ?? "",
      order: input.order ?? input.number,
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
  if (patch.solved !== undefined) data.solved = patch.solved;
  if (patch.must !== undefined) data.must = patch.must;
  if (patch.approaches !== undefined) {
    data.approaches = JSON.stringify(patch.approaches);
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
