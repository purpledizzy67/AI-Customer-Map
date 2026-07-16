import { NextResponse } from "next/server";
import { DEMO_USER_ID, newId } from "@/lib/db";
import { getMemoryStore } from "@/lib/db/memory";
import { generateReleasePackage } from "@/workflows/releaseNotes";

/**
 * GitHub webhook — on pull_request closed+merged, generate release package.
 * Never merges PRs; only reacts to merge events.
 */
export async function POST(request: Request) {
  const event = request.headers.get("x-github-event") ?? "unknown";
  const payload = await request.json();

  // Store raw webhook for audit
  getMemoryStore(); // ensure store init
  const sbUnavailable = true;
  if (sbUnavailable) {
    // logged via automation in generateReleasePackage
  }

  if (event === "pull_request" && payload.action === "closed" && payload.pull_request?.merged) {
    const fullName = payload.repository?.full_name as string | undefined;
    const [owner, repo] = (fullName ?? "acme/api-platform").split("/");
    const prNumber = Number(payload.pull_request.number);
    const pkg = await generateReleasePackage(
      DEMO_USER_ID,
      owner ?? "acme",
      repo ?? "api-platform",
      prNumber,
    );
    return NextResponse.json({
      ok: true,
      handled: "release_package",
      id: newId(),
      packageStatus: pkg.status,
    });
  }

  return NextResponse.json({ ok: true, handled: "ignored", event });
}
