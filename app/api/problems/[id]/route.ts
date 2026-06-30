import { type NextRequest, NextResponse } from "next/server";

import {
  createSessionClient,
  getLoggedInUser,
} from "@/lib/appwrite/server";
import { setApproachDone, updateProblem } from "@/lib/appwrite/tracker";

export const runtime = "nodejs";

type PatchBody = {
  solved?: boolean;
  must?: boolean;
  approachIndex?: number;
  done?: boolean;
};

/** Updates a single problem owned by the current user (toggle approach/solved). */
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
    result = await updateProblem(databases, user.$id, id, {
      solved: body.solved,
      must: body.must,
    });
  }

  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ problem: result });
}
