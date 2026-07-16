/**
 * STEP 5 — If confidence > threshold, prepare work artifacts under /projects/{slug}
 * Artifacts are generated locally; publishing still requires approval.
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { respondJson } from "@/lib/openai/client";
import { PREPARE_WORK_SYSTEM } from "@/prompts/workflows";
import { getLatestAnalysis, getLatestContext, saveProject, logAutomation } from "@/lib/db";
import { config } from "@/lib/config";
import { slugify } from "@/utils/helpers";
import type { EvidenceSource, PreparedArtifact, ProjectBundle } from "@/types";

interface PrepareJson {
  readme?: string;
  roadmap?: string;
  meetingNotes?: string;
  implementationChecklist?: string;
  todoList?: string;
  architectureSummary?: string;
  contextMd?: string;
}

function fallbackArtifacts(
  projectName: string,
  priority: string,
  evidence: EvidenceSource[],
): Record<string, string> {
  const evidenceMd = evidence
    .map(
      (e) =>
        `- **${e.provider}** ${e.title}${e.snippet ? `: ${e.snippet}` : ""}${e.url ? ` (${e.url})` : ""}`,
    )
    .join("\n");

  return {
    README: `# ${projectName}\n\n## Goal\n${priority}\n\n## Evidence\n${evidenceMd}\n\n## Status\nPrepared by Proactive AI Work Assistant. Review before acting.\n`,
    Roadmap: `# Roadmap — ${projectName}\n\n1. Clarify requirements from cited sources\n2. Draft architecture summary\n3. Implement checklist items\n4. Review with stakeholders\n5. Ship documentation & release notes\n`,
    "Meeting Notes": `# Meeting Notes — ${projectName}\n\n## Context\nPrepared from connected work apps. Do not treat as a transcript.\n\n## Linked evidence\n${evidenceMd}\n`,
    "Implementation Checklist": `# Implementation Checklist\n\n- [ ] Confirm priority with stakeholders\n- [ ] Gather coding context\n- [ ] Update API documentation\n- [ ] Add tests for critical paths\n- [ ] Prepare release notes (approval required)\n`,
    "TODO List": `# TODO — ${projectName}\n\n- [ ] ${priority}\n- [ ] Address blockers from analysis\n- [ ] Reply to related emails (manual send only)\n- [ ] Review open PRs\n`,
    "Architecture Summary": `# Architecture Summary — ${projectName}\n\n## Overview\nDerived from current GitHub/Notion signals. Validate before implementation.\n\n## Evidence\n${evidenceMd}\n`,
    "Context.md": `# Context — ${projectName}\n\nGenerated: ${new Date().toISOString()}\n\n## Priority\n${priority}\n\n## Source citations\n${evidenceMd}\n\n## Policy\nNever send emails, merge PRs, or post Slack replies automatically.\n`,
  };
}

async function writeArtifacts(
  slug: string,
  files: Record<string, string>,
): Promise<PreparedArtifact[]> {
  const dir = path.join(process.cwd(), "projects", slug);
  await mkdir(dir, { recursive: true });
  const artifacts: PreparedArtifact[] = [];
  for (const [title, content] of Object.entries(files)) {
    const filename =
      title === "Context.md"
        ? "Context.md"
        : `${title.replace(/\s+/g, "-")}.md`;
    const filePath = path.join(dir, filename);
    await writeFile(filePath, content, "utf8");
    artifacts.push({
      path: `/projects/${slug}/${filename}`,
      title,
      content,
    });
  }
  return artifacts;
}

export async function prepareProjectWork(
  userId: string,
  projectName: string,
  confidence: number,
  evidence: EvidenceSource[],
  priority = projectName,
): Promise<ProjectBundle> {
  const context = await getLatestContext(userId);
  const analysis = await getLatestAnalysis(userId);
  const resolvedPriority = analysis?.priority ?? priority;

  const llm = await respondJson<PrepareJson>({
    system: PREPARE_WORK_SYSTEM,
    user: JSON.stringify({
      projectName,
      priority: resolvedPriority,
      evidence,
      contextSummary: {
        emails: context?.emails.slice(0, 5),
        github: context?.github.slice(0, 8),
        notion: context?.notion.slice(0, 8),
        slack: context?.slack.slice(0, 5),
        meetings: context?.meetings.slice(0, 5),
      },
    }),
  });

  const files = llm
    ? {
        README: llm.readme ?? fallbackArtifacts(projectName, resolvedPriority, evidence).README,
        Roadmap: llm.roadmap ?? "",
        "Meeting Notes": llm.meetingNotes ?? "",
        "Implementation Checklist": llm.implementationChecklist ?? "",
        "TODO List": llm.todoList ?? "",
        "Architecture Summary": llm.architectureSummary ?? "",
        "Context.md": llm.contextMd ?? "",
      }
    : fallbackArtifacts(projectName, resolvedPriority, evidence);

  const slug = slugify(projectName);
  const artifacts = await writeArtifacts(slug, files);

  const bundle: ProjectBundle = {
    projectName,
    slug,
    artifacts,
    createdAt: new Date().toISOString(),
    confidence,
    evidence,
  };

  await saveProject(userId, bundle);
  return bundle;
}

/** Auto-prepare when confidence exceeds threshold (still stores drafts only) */
export async function maybeAutoPrepareWork(userId: string): Promise<ProjectBundle | null> {
  const analysis = await getLatestAnalysis(userId);
  if (!analysis) return null;
  if (analysis.confidence <= config.confidenceThreshold) {
    await logAutomation(userId, {
      type: "prepare_work",
      title: "Skipped auto-prepare",
      detail: `Confidence ${analysis.confidence.toFixed(2)} ≤ threshold ${config.confidenceThreshold}`,
      status: "skipped",
      evidence: analysis.evidence,
    });
    return null;
  }
  return prepareProjectWork(
    userId,
    analysis.project,
    analysis.confidence,
    analysis.evidence,
    analysis.priority,
  );
}
