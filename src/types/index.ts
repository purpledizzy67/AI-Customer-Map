/**
 * Core domain types for the Proactive AI Work Assistant.
 * All recommendations must cite EvidenceSources — never hallucinate.
 */

export type Provider =
  | "google"
  | "gmail"
  | "calendar"
  | "slack"
  | "github"
  | "notion";

export type ConnectionStatus = "connected" | "expired" | "error" | "disconnected";

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: Provider;
  accountEmail?: string;
  accountName?: string;
  status: ConnectionStatus;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
  lastSyncAt?: string;
}

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  tag: string;
}

export interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  tokenType?: string;
  scope?: string;
}

export interface EvidenceSource {
  provider: Provider | "system";
  type: string;
  id?: string;
  title: string;
  url?: string;
  snippet?: string;
  timestamp?: string;
}

export interface EmailItem {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  snippet: string;
  labels: string[];
  starred: boolean;
  unread: boolean;
  mentionsProject?: string[];
  receivedAt: string;
  url?: string;
}

export interface MeetingItem {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  attendees: { email: string; name?: string; responseStatus?: string }[];
  location?: string;
  hangoutLink?: string;
  url?: string;
}

export interface SlackItem {
  id: string;
  channelId: string;
  channelName: string;
  type: "mention" | "dm" | "thread" | "reaction" | "unread";
  text: string;
  user: string;
  timestamp: string;
  threadTs?: string;
  permalink?: string;
  unread?: boolean;
}

export interface GitHubItem {
  id: string;
  type: "pr" | "review_request" | "issue" | "commit" | "repo";
  number?: number;
  title: string;
  repo: string;
  state?: string;
  url: string;
  author?: string;
  updatedAt: string;
  labels?: string[];
  draft?: boolean;
}

export interface NotionItem {
  id: string;
  type: "page" | "database" | "task" | "doc";
  title: string;
  url?: string;
  lastEdited: string;
  parent?: string;
  status?: string;
  assignee?: string;
  properties?: Record<string, unknown>;
}

export interface UnifiedContext {
  userId: string;
  emails: EmailItem[];
  meetings: MeetingItem[];
  github: GitHubItem[];
  slack: SlackItem[];
  notion: NotionItem[];
  timestamp: string;
  collectionErrors: { provider: Provider; message: string }[];
}

export interface SuggestedAction {
  id: string;
  type:
    | "prepare_work"
    | "meeting_brief"
    | "release_notes"
    | "slack_reply"
    | "focus_block"
    | "reply_email"
    | "review_pr"
    | "update_notion"
    | "custom";
  title: string;
  description: string;
  project?: string;
  confidence: number;
  evidence: EvidenceSource[];
  requiresApproval: true;
  payload?: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
}

export interface PriorityAnalysis {
  priority: string;
  project: string;
  confidence: number;
  urgentWork: string[];
  likelyNextProject: string;
  blockers: string[];
  documentsNeeded: string[];
  codingContextNeeded: string[];
  actions: SuggestedAction[];
  evidence: EvidenceSource[];
  rationale: string;
  analyzedAt: string;
}

export interface PreparedArtifact {
  path: string;
  title: string;
  content: string;
}

export interface ProjectBundle {
  projectName: string;
  slug: string;
  artifacts: PreparedArtifact[];
  createdAt: string;
  confidence: number;
  evidence: EvidenceSource[];
}

export interface MeetingBrief {
  meetingId: string;
  meetingTitle: string;
  start: string;
  attendees: string[];
  previousEmails: EmailItem[];
  slackConversations: SlackItem[];
  githubIssues: GitHubItem[];
  openPrs: GitHubItem[];
  notionDocs: NotionItem[];
  customerHistory: string[];
  questionsToAsk: string[];
  risks: string[];
  actionItems: string[];
  summary: string;
  evidence: EvidenceSource[];
  createdAt: string;
}

export interface ReleasePackage {
  prNumber: number;
  repo: string;
  title: string;
  releaseNotes: string;
  apiDocumentation: string;
  migrationNotes: string;
  changelog: string;
  notionUpdate: string;
  evidence: EvidenceSource[];
  createdAt: string;
  status: "pending_approval" | "approved" | "published";
}

export interface SuggestedReply {
  id: string;
  slackChannelId: string;
  slackThreadTs?: string;
  question: string;
  draftAnswer: string;
  sources: EvidenceSource[];
  confidence: number;
  status: "draft" | "approved" | "discarded" | "posted";
  createdAt: string;
}

export interface MorningDashboard {
  date: string;
  priorities: { text: string; evidence: EvidenceSource[]; confidence: number }[];
  meetings: MeetingItem[];
  openPrs: GitHubItem[];
  emailsNeedingReplies: EmailItem[];
  blockedWork: { text: string; evidence: EvidenceSource[] }[];
  suggestedFocusSchedule: {
    start: string;
    end: string;
    focus: string;
    reason: string;
  }[];
  estimatedWorkloadHours: number;
  generatedAt: string;
}

export interface EveningSummary {
  date: string;
  completedWork: string[];
  mergedPrs: GitHubItem[];
  emailsAnswered: EmailItem[];
  meetingsAttended: MeetingItem[];
  remainingBlockers: string[];
  tomorrowPriorities: string[];
  generatedAt: string;
}

export interface AutomationEvent {
  id: string;
  userId: string;
  type: string;
  title: string;
  detail: string;
  status: "success" | "pending" | "failed" | "skipped";
  evidence?: EvidenceSource[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineEvent {
  id: string;
  userId: string;
  provider: Provider | "ai" | "system";
  title: string;
  description: string;
  timestamp: string;
  url?: string;
  confidence?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  evidence?: EvidenceSource[];
  confidence?: number;
  createdAt: string;
}

export interface SearchResult {
  id: string;
  provider: Provider;
  title: string;
  snippet: string;
  url?: string;
  score: number;
  timestamp?: string;
}

export interface EmbeddingRecord {
  id: string;
  userId: string;
  sourceProvider: Provider;
  sourceId: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  timezone: string;
  createdAt: string;
}
