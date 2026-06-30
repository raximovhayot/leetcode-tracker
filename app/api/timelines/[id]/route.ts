import { type NextRequest, NextResponse } from "next/server";

import { createSessionClient, getLoggedInUser } from "@/lib/appwrite/server";
import {
  deleteTimeline,
  updateTimeline,
  type UpdateTimelineInput,
} from "@/lib/appwrite/timelines";

export const runtime = "nodejs";

type PatchBody = {
  name?: string;
  startAt?: string;
  endAt?: string;
  order?: number;
  problemIds?: string[];
};

/** Updates a single timeline owned by the current user. */
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

  const patch: UpdateTimelineInput = {
    name: body.name,
    startAt: body.startAt,
    endAt: body.endAt,
    order: body.order,
    problemIds: body.problemIds,
  };

  const result = await updateTimeline(databases, user.$id, id, patch);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ timeline: result });
}

/** Deletes a single timeline owned by the current user. */
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

  const ok = await deleteTimeline(databases, user.$id, id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
