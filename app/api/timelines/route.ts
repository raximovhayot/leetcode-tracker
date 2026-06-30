import { type NextRequest, NextResponse } from "next/server";

import { createSessionClient, getLoggedInUser } from "@/lib/appwrite/server";
import { addTimeline, type AddTimelineInput } from "@/lib/appwrite/timelines";

export const runtime = "nodejs";

type PostBody = {
  name?: string;
  startAt?: string;
  endAt?: string;
  order?: number;
  problemIds?: string[];
};

/** Creates a new timeline owned by the current user. */
export async function POST(request: NextRequest) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as PostBody;
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const input: AddTimelineInput = {
    name: body.name.trim(),
    startAt: body.startAt,
    endAt: body.endAt,
    order: body.order,
    problemIds: Array.isArray(body.problemIds) ? body.problemIds : [],
  };

  const { databases } = await createSessionClient();
  const timeline = await addTimeline(databases, user.$id, input);
  return NextResponse.json({ timeline }, { status: 201 });
}
