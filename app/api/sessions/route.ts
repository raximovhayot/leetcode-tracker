import { NextResponse } from "next/server";

import { createSessionClient, getLoggedInUser } from "@/lib/appwrite/server";

export const runtime = "nodejs";

/** Lists the current user's active login sessions (devices). */
export async function GET() {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { account } = await createSessionClient();
    const res = await account.listSessions();
    const sessions = res.sessions.map((session) => ({
      id: session.$id,
      current: session.current,
      provider: session.provider,
      clientName: session.clientName,
      osName: session.osName,
      deviceName: session.deviceName,
      ip: session.ip,
      countryName: session.countryName,
      createdAt: session.$createdAt,
    }));
    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}
