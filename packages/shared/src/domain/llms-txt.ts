export interface LLMSTxtData {
  name: string;
  domain: string;
  description: string;
  sections?: Array<{
    title: string;
    items: Array<{
      title: string;
      url: string;
      description?: string;
    }>;
  }>;
}

export class LLMSTxtGenerator {
  /**
   * Generates a standard /llms.txt file content.
   * Based on the draft proposal: https://llmstxt.org/
   */
  static generate(data: LLMSTxtData): string {
    let output = `# ${data.name}

`;
    output += `> ${data.description}

`;

    if (data.sections) {
      for (const section of data.sections) {
        output += `## ${section.title}

`;
        for (const item of section.items) {
          output += `- [${item.title}](${item.url})${
            item.description ? `: ${item.description}` : ""
          }
`;
        }
        output += "\n";
      }
    }

    return output.trim();
  }

  /**
   * Generates a detailed /llms-full.txt file content.
   */
  static generateFull(data: LLMSTxtData): string {
    // For now, similar to summary but could include more metadata
    return this.generate(data);
  }
}
