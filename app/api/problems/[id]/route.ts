import { type NextRequest, NextResponse } from "next/server";

import {
  createSessionClient,
  getLoggedInUser,
} from "@/lib/appwrite/server";
import {
  deleteProblem,
  setApproachDone,
  updateProblem,
  type UpdateProblemInput,
} from "@/lib/appwrite/tracker";
import type { Approach, Difficulty } from "@/lib/types";

export const runtime = "nodejs";

type PatchBody = {
  number?: number;
  title?: string;
  url?: string;
  difficulty?: Difficulty;
  phaseId?: string;
  order?: number;
  solved?: boolean;
  must?: boolean;
  approaches?: Approach[];
  approachIndex?: number;
  done?: boolean;
};

/** Updates a single problem owned by the current user. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as PatchBody;
  const { databases } = await createSessionClient();

  let result;
  if (
    typeof body.approachIndex === "number" &&
    typeof body.done === "boolean"
  ) {
    result = await setApproachDone(
      databases,
      user.$id,
      id,
      body.approachIndex,
      body.done,
    );
  } else {
    const patch: UpdateProblemInput = {
      number: body.number,
      title: body.title,
      url: body.url,
      difficulty: body.difficulty,
      phaseId: body.phaseId,
      order: body.order,
      solved: body.solved,
      must: body.must,
      approaches: body.approaches,
    };
    result = await updateProblem(databases, user.$id, id, patch);
  }

  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ problem: result });
}

/** Deletes a single problem owned by the current user. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { databases } = await createSessionClient();

  const ok = await deleteProblem(databases, user.$id, id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
