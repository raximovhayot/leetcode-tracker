import "server-only";

import { Query } from "node-appwrite";

import { appwriteConfig } from "../appwrite/config";
import { createAdminClient } from "../appwrite/server";
import {
  addPhase,
  addProblem,
  type AddProblemInput,
  listTracker,
  updateProblem,
} from "../appwrite/tracker";
import { computeStats } from "../stats";
import type { Approach, Difficulty } from "../types";

const { databaseId, phasesCollectionId, problemsCollectionId } = appwriteConfig;

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export type McpTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (userId: string, args: Record<string, unknown>) => Promise<unknown>;
};

function asApproaches(value: unknown): Approach[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { name: item, done: false };
      if (item && typeof item === "object" && "name" in item) {
        const obj = item as Record<string, unknown>;
        return { name: String(obj.name), done: Boolean(obj.done) };
      }
      return null;
    })
    .filter((a): a is Approach => a !== null);
}

/** Finds a phase by case-insensitive name, creating it when missing. */
async function resolvePhaseId(
  userId: string,
  phaseName: string,
): Promise<string> {
  const { databases } = createAdminClient();
  const res = await databases.listDocuments(databaseId, phasesCollectionId, [
    Query.equal("userId", userId),
    Query.limit(200),
  ]);
  const match = res.documents.find(
    (d) =>
      String((d as Record<string, unknown>).name).toLowerCase() ===
      phaseName.toLowerCase(),
  );
  if (match) return match.$id;

  const created = await addPhase(databases, userId, {
    name: phaseName,
    order: res.documents.length + 1,
  });
  return created.$id;
}

async function findProblemByNumber(userId: string, number: number) {
  const { databases } = createAdminClient();
  const res = await databases.listDocuments(databaseId, problemsCollectionId, [
    Query.equal("userId", userId),
    Query.equal("number", number),
    Query.limit(1),
  ]);
  return res.documents[0] ?? null;
}

type ProblemArg = {
  number: number;
  title: string;
  url?: string;
  difficulty?: Difficulty;
  must?: boolean;
  solved?: boolean;
  order?: number;
  approaches?: unknown;
};

async function insertProblem(userId: string, phaseId: string, p: ProblemArg) {
  const { databases } = createAdminClient();
  const input: AddProblemInput = {
    phaseId,
    number: Number(p.number),
    title: String(p.title),
    url: p.url ? String(p.url) : undefined,
    difficulty: p.difficulty ?? "Easy",
    must: Boolean(p.must),
    solved: Boolean(p.solved),
    order: p.order === undefined ? 0 : Number(p.order),
    approaches: asApproaches(p.approaches),
  };
  return addProblem(databases, userId, input);
}

export const mcpTools: McpTool[] = [
  {
    name: "list_phases",
    description:
      "List all phases (categories) in the user's study tracker, in order.",
    inputSchema: { type: "object", properties: {} },
    handler: async (userId) => {
      const { databases } = createAdminClient();
      const tracker = await listTracker(databases, userId);
      return tracker.map((p) => ({
        id: p.$id,
        name: p.name,
        order: p.order,
        problemCount: p.problems.length,
      }));
    },
  },
  {
    name: "add_phase",
    description: "Create a new phase (category) for grouping problems.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Phase name, e.g. 'Two Pointers'." },
        order: { type: "number", description: "Optional sort order." },
      },
      required: ["name"],
    },
    handler: async (userId, args) => {
      const { databases } = createAdminClient();
      const phase = await addPhase(databases, userId, {
        name: String(args.name),
        order: args.order === undefined ? undefined : Number(args.order),
      });
      return { id: phase.$id, name: phase.name, order: phase.order };
    },
  },
  {
    name: "list_problems",
    description:
      "List problems, optionally filtered to a phase name. Returns numbers, titles and progress.",
    inputSchema: {
      type: "object",
      properties: {
        phase: { type: "string", description: "Optional phase name to filter by." },
      },
    },
    handler: async (userId, args) => {
      const { databases } = createAdminClient();
      const tracker = await listTracker(databases, userId);
      const phaseFilter = args.phase
        ? String(args.phase).toLowerCase()
        : null;
      return tracker
        .filter((ph) => !phaseFilter || ph.name.toLowerCase() === phaseFilter)
        .flatMap((ph) =>
          ph.problems.map((pr) => ({
            phase: ph.name,
            number: pr.number,
            title: pr.title,
            difficulty: pr.difficulty,
            must: pr.must,
            solved: pr.solved,
            approaches: pr.approaches,
          })),
        );
    },
  },
  {
    name: "add_problem",
    description:
      "Add a single LeetCode problem to a phase. The phase is created automatically if it does not exist.",
    inputSchema: {
      type: "object",
      properties: {
        phase: { type: "string", description: "Phase name to add the problem to." },
        number: { type: "number", description: "LeetCode problem number." },
        title: { type: "string", description: "Problem title." },
        url: { type: "string", description: "LeetCode problem URL." },
        difficulty: {
          type: "string",
          enum: ["Easy", "Medium", "Hard"],
          description: "Problem difficulty.",
        },
        must: { type: "boolean", description: "Mark as a must-do problem." },
        order: {
          type: "number",
          description: "Sort order within the phase (lower comes first). Defaults to 0.",
        },
        approaches: {
          type: "array",
          description:
            "Solution approaches. Each item is a string name or { name, done }.",
          items: { type: "string" },
        },
      },
      required: ["phase", "number", "title"],
    },
    handler: async (userId, args) => {
      const phaseId = await resolvePhaseId(userId, String(args.phase));
      const problem = await insertProblem(userId, phaseId, {
        number: Number(args.number),
        title: String(args.title),
        url: args.url ? String(args.url) : undefined,
        difficulty: args.difficulty as Difficulty | undefined,
        must: Boolean(args.must),
        order: args.order === undefined ? undefined : Number(args.order),
        approaches: args.approaches,
      });
      return { id: problem.$id, number: problem.number, title: problem.title };
    },
  },
  {
    name: "add_problems_bulk",
    description:
      "Add many problems to one phase in a single call. The phase is created if missing.",
    inputSchema: {
      type: "object",
      properties: {
        phase: { type: "string", description: "Phase name for all problems." },
        problems: {
          type: "array",
          description: "Array of problems to add.",
          items: {
            type: "object",
            properties: {
              number: { type: "number" },
              title: { type: "string" },
              url: { type: "string" },
              difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
              must: { type: "boolean" },
              order: { type: "number" },
              approaches: { type: "array", items: { type: "string" } },
            },
            required: ["number", "title"],
          },
        },
      },
      required: ["phase", "problems"],
    },
    handler: async (userId, args) => {
      const phaseId = await resolvePhaseId(userId, String(args.phase));
      const list = Array.isArray(args.problems) ? args.problems : [];
      const added: number[] = [];
      for (const raw of list as ProblemArg[]) {
        const problem = await insertProblem(userId, phaseId, raw);
        added.push(problem.number);
      }
      return { added: added.length, numbers: added };
    },
  },
  {
    name: "set_approach_done",
    description:
      "Mark a named approach of a problem as done or not done (matched by problem number).",
    inputSchema: {
      type: "object",
      properties: {
        number: { type: "number", description: "LeetCode problem number." },
        approach: { type: "string", description: "Approach name to toggle." },
        done: { type: "boolean", description: "Completion state." },
      },
      required: ["number", "approach", "done"],
    },
    handler: async (userId, args) => {
      const doc = await findProblemByNumber(userId, Number(args.number));
      if (!doc) return { updated: false, reason: "Problem not found." };

      const { databases } = createAdminClient();
      const docFields = doc as Record<string, unknown>;
      const approaches: Approach[] = (() => {
        try {
          const parsed = JSON.parse(String(docFields.approaches ?? "[]"));
          return Array.isArray(parsed) ? (parsed as Approach[]) : [];
        } catch {
          return [];
        }
      })();

      const target = String(args.approach).toLowerCase();
      const next = approaches.map((a) =>
        a.name.toLowerCase() === target ? { ...a, done: Boolean(args.done) } : a,
      );
      await updateProblem(databases, userId, doc.$id, { approaches: next });
      return { updated: true };
    },
  },
  {
    name: "set_problem_solved",
    description: "Mark a problem (by number) as solved or unsolved.",
    inputSchema: {
      type: "object",
      properties: {
        number: { type: "number", description: "LeetCode problem number." },
        solved: { type: "boolean", description: "Solved state." },
      },
      required: ["number", "solved"],
    },
    handler: async (userId, args) => {
      const doc = await findProblemByNumber(userId, Number(args.number));
      if (!doc) return { updated: false, reason: "Problem not found." };
      const { databases } = createAdminClient();
      await updateProblem(databases, userId, doc.$id, {
        solved: Boolean(args.solved),
      });
      return { updated: true };
    },
  },
  {
    name: "get_stats",
    description:
      "Get the dashboard counters: problems solved, approaches done, progress %, and must-do progress.",
    inputSchema: { type: "object", properties: {} },
    handler: async (userId) => {
      const { databases } = createAdminClient();
      const tracker = await listTracker(databases, userId);
      return computeStats(tracker);
    },
  },
];

export function getToolDefinitions() {
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

export async function callTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = mcpTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.handler(userId, args ?? {});
}
