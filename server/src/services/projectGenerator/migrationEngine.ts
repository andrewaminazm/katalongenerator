import type { MigrationInput, MigrationResult, GeneratedFile } from "./types.js";
import { buildArchitecturePlan } from "./architectureEngine.js";
import { generateApiFramework } from "./apiFrameworkGenerator.js";
import { generateKeywords } from "./keywordGenerator.js";
import { scaffoldProjectTree } from "./projectScaffolder.js";
import { assembleProjectZip } from "./zipExport.js";
import { createHash } from "node:crypto";

function parsePostmanCollection(text: string): { name: string; folders: string[] } {
  try {
    const json = JSON.parse(text) as { info?: { name?: string }; item?: { name?: string }[] };
    const name = json.info?.name ?? "MigratedApiProject";
    const folders =
      json.item?.map((i) => i.name ?? "Request").filter(Boolean) ?? ["API"];
    return { name, folders };
  } catch {
    return { name: "MigratedApiProject", folders: ["API"] };
  }
}

export async function runMigration(input: MigrationInput): Promise<MigrationResult> {
  const warnings: string[] = [];
  let projectName = input.projectName.trim() || "MigratedProject";
  let modules = ["Auth", "API"];

  if (input.sourceType === "postman") {
    const parsed = parsePostmanCollection(input.payload);
    projectName = input.projectName || parsed.name.replace(/[^a-zA-Z0-9 _-]/g, "");
    modules = parsed.folders.slice(0, 8);
    warnings.push(`Imported ${modules.length} Postman folder(s) as API modules.`);
  } else {
    warnings.push(
      `${input.sourceType} migration produces scaffold only — manual refinement recommended.`
    );
  }

  const plan = buildArchitecturePlan({
    projectName,
    description: `Migration from ${input.sourceType}`,
    frameworkKind: "api",
    architecturePattern: input.targetPattern ?? "microservice-api",
    domain: "generic",
    projectSize: "standard",
    reuseMode: "generate_everything",
    inputSources: ["postman"],
    businessFlows: [],
    modules,
    includeReporting: true,
    includeBdd: false,
    includePerformance: false,
    includeMobile: false,
    postmanText: input.sourceType === "postman" ? input.payload : undefined,
  });

  const files: GeneratedFile[] = [
    ...scaffoldProjectTree(plan),
    ...generateKeywords(plan).files,
    ...generateApiFramework(plan).files,
  ];

  const generationId = createHash("sha256")
    .update(JSON.stringify({ projectName, source: input.sourceType }))
    .digest("hex")
    .slice(0, 16);

  const zipPath = await assembleProjectZip(generationId, files);

  return { generationId, projectName, files, warnings, zipPath };
}
