import { type NextRequest, NextResponse } from "next/server";

import {
  createSessionClient,
  getLoggedInUser,
} from "@/lib/appwrite/server";
import {
  addProblem,
  type AddProblemInput,
  listAllProblems,
  listProblemsByIds,
} from "@/lib/appwrite/tracker";
import { listTimelinesMeta } from "@/lib/appwrite/timelines";
import type { Approach, Difficulty } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Lists the current user's problems. When a `timelineId` query param is given,
 * only that timeline's problems are read (keeps Appwrite reads scoped); without
 * it, the whole collection is returned.
 */
export async function GET(request: NextRequest) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timelineId = request.nextUrl.searchParams.get("timelineId");
  const { databases } = await createSessionClient();

  if (!timelineId) {
    const problems = await listAllProblems(databases, user.$id);
    return NextResponse.json({ problems });
  }

  const timelines = await listTimelinesMeta(databases, user.$id);
  const timeline = timelines.find((t) => t.$id === timelineId);
  if (!timeline) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const problems = await listProblemsByIds(
    databases,
    user.$id,
    timeline.problemIds,
  );
  return NextResponse.json({ problems });
}

type PostBody = {
  phaseId?: string;
  number?: number;
  title?: string;
  url?: string;
  difficulty?: Difficulty;
  must?: boolean;
  solved?: boolean;
  order?: number;
  approaches?: Approach[];
};

/** Creates a new problem owned by the current user. */
export async function POST(request: NextRequest) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as PostBody;
  if (!body.phaseId || typeof body.number !== "number" || !body.title) {
    return NextResponse.json(
      { error: "phaseId, number and title are required" },
      { status: 400 },
    );
  }

  const input: AddProblemInput = {
    phaseId: body.phaseId,
    number: body.number,
    title: body.title,
    url: body.url,
    difficulty: body.difficulty,
    must: body.must,
    solved: body.solved,
    order: body.order,
    approaches: body.approaches,
  };

  const { databases } = await createSessionClient();
  const problem = await addProblem(databases, user.$id, input);
  return NextResponse.json({ problem }, { status: 201 });
}
