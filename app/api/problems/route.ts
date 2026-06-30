import { type NextRequest, NextResponse } from "next/server";

import {
  createSessionClient,
  getLoggedInUser,
} from "@/lib/appwrite/server";
import { addProblem, type AddProblemInput } from "@/lib/appwrite/tracker";
import type { Approach, Difficulty } from "@/lib/types";

export const runtime = "nodejs";

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
