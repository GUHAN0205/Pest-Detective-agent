import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  return Response.json({ user });
}
