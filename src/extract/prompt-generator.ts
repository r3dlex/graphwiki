import { writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';

export async function generateExtractionPrompt(
  sourceFile: string,
  pendingDir: string,
): Promise<string> {
  await mkdir(pendingDir, { recursive: true });
  const slug = basename(sourceFile).replace(/[^a-zA-Z0-9._-]/g, '_');
  const promptPath = join(pendingDir, `${slug}.prompt.md`);
  const resultPath = join(pendingDir, `${slug}.result.json`);

  const prompt = `# Extract Knowledge Graph

Source: \`${sourceFile}\`
Output: \`${resultPath}\`

Read the source file and extract a knowledge graph as JSON:

\`\`\`json
{
  "nodes": [{ "id": "...", "type": "concept|entity|rationale", "label": "...", "source": "${sourceFile}" }],
  "edges": [{ "id": "...", "source": "...", "target": "...", "label": "related_to|depends_on" }]
}
\`\`\`

Write the JSON to \`${resultPath}\`.
`;

  await writeFile(promptPath, prompt, 'utf-8');
  return promptPath;
}
