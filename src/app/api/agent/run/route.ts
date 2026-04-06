import { POST as runAgent } from "../../openclaw/agent/route";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return runAgent(req);
}
