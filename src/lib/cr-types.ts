// ===== Workspace =====
export interface CrWorkspaceFile {
  path: string;
  name: string;
  content: string;
  lastModified: string;
  size: number;
}

export interface CrParsedMarkdown {
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  sections: CrMarkdownSection[];
}

export interface CrMarkdownSection {
  heading: string;
  level: number;
  content: string;
}

// ===== Content Pipeline =====
export interface CrContentItem {
  id: string;
  title: string;
  type: "blog" | "social" | "email" | "video" | "doc";
  status: "idea" | "drafting" | "review" | "scheduled" | "published";
  author?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

// ===== Comms =====
export interface CrCommsDigest {
  channel: "discord" | "telegram";
  messages: number;
  lastActivity: string;
  highlights: string[];
}

// ===== CRM / Contacts =====
export interface CrContact {
  id: string;
  name: string;
  company?: string;
  type: "client" | "lead" | "partner" | "vendor";
  stage: "prospect" | "contacted" | "negotiation" | "won" | "lost";
  value?: number;
  notes?: string;
  tags?: string[];
}

// ===== Knowledge =====
export interface CrKnowledgeFile {
  path: string;
  name: string;
  category: string;
  size: number;
  lastModified: string;
  preview?: string;
}

// ===== Ecosystem =====
export interface CrEcosystemProduct {
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  color: string;
  status: "active" | "development" | "planned" | "archived";
  techStack: string[];
  links?: Record<string, string>;
  metrics?: Record<string, number | string>;
}

// ===== Code / Repos =====
export interface CrRepoInfo {
  name: string;
  path: string;
  branch: string;
  lastCommit: string;
  lastCommitMessage: string;
  dirty: boolean;
  ahead: number;
  behind: number;
}

// ===== Revenue =====
export interface CrRevenueMetrics {
  mrr: number;
  arr: number;
  growth: number;
  customers: number;
  pipeline: number;
}

// ===== API Response =====
export interface CrApiResponse<T> {
  data: T;
  error?: string;
  timestamp: string;
}

// ===== Tab =====
export interface CrTabItem {
  id: string;
  label: string;
  icon?: string;
}
