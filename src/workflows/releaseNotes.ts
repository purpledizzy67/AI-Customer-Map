/**
 * STEP 7 — On merged PR, generate release package (approval required before Notion update).
 */

import { respondJson } from "@/lib/openai/client";
import { RELEASE_NOTES_SYSTEM } from "@/prompts/workflows";
import { githubService } from "@/services/githubService";
import { getLatestContext, saveReleasePackage, logAutomation } from "@/lib/db";
import type { EvidenceSource, ReleasePackage } from "@/types";

interface ReleaseLlm {
  releaseNotes?: string;
  apiDocumentation?: string;
  migrationNotes?: string;
  changelog?: string;
  notionUpdate?: string;
}

export async function generateReleasePackage(
  userId: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReleasePackage> {
  const pr = await githubService.getPullRequest(userId, owner, repo, prNumber);
  const context = await getLatestContext(userId);

  const evidence: EvidenceSource[] = [
    {
      provider: "github",
      type: "pr",
      id: String(prNumber),
      title: pr?.title ?? `PR #${prNumber}`,
      url: pr?.html_url,
    },
  ];

  const relatedNotion = (context?.notion ?? [])
    .filter((n) => /api|release|migration|doc/i.test(n.title))
    .slice(0, 5);
  for (const n of relatedNotion) {
    evidence.push({
      provider: "notion",
      type: n.type,
      id: n.id,
      title: n.title,
      url: n.url,
    });
  }

  const llm = await respondJson<ReleaseLlm>({
    system: RELEASE_NOTES_SYSTEM,
    user: JSON.stringify({
      pr,
      relatedNotion,
      relatedGithub: context?.github.filter((g) => g.repo === `${owner}/${repo}`),
    }),
  });

  const title = pr?.title ?? `PR #${prNumber}`;
  const pkg: ReleasePackage = {
    prNumber,
    repo: `${owner}/${repo}`,
    title,
    releaseNotes:
      llm?.releaseNotes ??
      `## Release Notes\n\n### ${title}\n\nMerged PR #${prNumber} in ${owner}/${repo}.\n\n${pr?.body ?? ""}\n`,
    apiDocumentation:
      llm?.apiDocumentation ??
      `## API Documentation\n\nUpdate docs to reflect changes from PR #${prNumber}. Review OpenAPI diffs before publishing.\n`,
    migrationNotes:
      llm?.migrationNotes ??
      `## Migration Notes\n\nNo automatic migration detected. Confirm breaking changes from PR description before rollout.\n`,
    changelog:
      llm?.changelog ??
      `## Changelog\n\n- ${title} (#${prNumber})\n`,
    notionUpdate:
      llm?.notionUpdate ??
      `Update Notion release page with PR #${prNumber} summary. **Requires approval before posting.**`,
    evidence,
    createdAt: new Date().toISOString(),
    status: "pending_approval",
  };

  await saveReleasePackage(userId, pkg);
  await logAutomation(userId, {
    type: "release_notes",
    title: `Release package for PR #${prNumber}`,
    detail: "Draft release notes ready — Notion update requires approval",
    status: "pending",
    evidence,
  });

  return pkg;
}
