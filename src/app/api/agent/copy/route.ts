import { POST as generateCopy } from "../../openclaw/copy/route";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return generateCopy(req);
}
