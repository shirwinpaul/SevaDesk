import { handleAiRequest } from "@/lib/ai/handler";

// Vercel Hobby allows up to 60s; providers time out at 25s each.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handleAiRequest(req, process.env);
}
