import matter from "gray-matter";
import type { CrParsedMarkdown, CrMarkdownSection } from "./cr-types";

export function parseMarkdown(raw: string): CrParsedMarkdown {
  const { data: frontmatter, content } = matter(raw);

  const sections = extractSections(content);
  const title =
    (frontmatter.title as string) ||
    sections[0]?.heading ||
    content.split("\n")[0]?.replace(/^#+\s*/, "") ||
    "Untitled";

  return { title, content, frontmatter, sections };
}

function extractSections(content: string): CrMarkdownSection[] {
  const lines = content.split("\n");
  const sections: CrMarkdownSection[] = [];
  let currentSection: CrMarkdownSection | null = null;
  const contentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

    if (headingMatch) {
      if (currentSection) {
        currentSection.content = contentLines.join("\n").trim();
        sections.push(currentSection);
        contentLines.length = 0;
      }
      currentSection = {
        heading: headingMatch[2],
        level: headingMatch[1].length,
        content: "",
      };
    } else if (currentSection) {
      contentLines.push(line);
    }
  }

  if (currentSection) {
    currentSection.content = contentLines.join("\n").trim();
    sections.push(currentSection);
  }

  return sections;
}

export function extractListItems(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim());
}

export function extractCodeBlocks(content: string): string[] {
  const blocks: string[] = [];
  const regex = /```[\s\S]*?```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[0].replace(/```\w*\n?/g, "").trim());
  }
  return blocks;
}
