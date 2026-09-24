import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function safePath(relativePath: string) {
    if (path.isAbsolute(relativePath)) {
        throw new Error("ABSOLUTE_PATH_NOT_ALLOWED");
    }

    const normalized = path.normalize(relativePath);

    if (normalized.startsWith("..")) {
        throw new Error("PATH_TRAVERSAL_NOT_ALLOWED");
    }

    return path.join(ROOT, normalized);
}

async function readText(relativePath: string) {
    const fullPath = safePath(relativePath);
    return fs.readFile(fullPath, "utf8");
}

async function writeText(relativePath: string, content: string) {
    const normalized = path.normalize(relativePath);

    if (!normalized.startsWith("artifacts\\")) {
        throw new Error("WRITE_ONLY_ALLOWED_INSIDE_ARTIFACTS");
    }

    const fullPath = safePath(normalized);
    await fs.writeFile(fullPath, content, "utf8");

    return normalized;
}

async function appendText(relativePath: string, content: string) {
    const fullPath = safePath(relativePath);
    await fs.appendFile(fullPath, content, "utf8");
}

async function listFiles(dir: string): Promise<string[]> {
    const fullDir = safePath(dir);
    const entries = await fs.readdir(fullDir, { withFileTypes: true });

    const files: string[] = [];

    for (const entry of entries) {
        const relative = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...await listFiles(relative));
        } else {
            files.push(relative);
        }
    }

    return files;
}

function createServer() {
    const server = new McpServer({
        name: "legal-lookup-agent-workspace",
        version: "1.0.0"
    });

    server.registerTool(
        "read_project_brief",
        {
            description: "Read the main project brief",
            inputSchema: z.object({})
        },
        async () => {
            const content = await readText("project/brief.md");

            return {
                content: [
                    {
                        type: "text",
                        text: content
                    }
                ]
            };
        }
    );

    server.registerTool(
        "read_agent_role",
        {
            description: "Read the role instruction of one agent",
            inputSchema: z.object({
                agent: z.enum([
                    "coordinator",
                    "db",
                    "backend",
                    "frontend",
                    "design"
                ])
            })
        },
        async ({ agent }) => {
            const fileMap = {
                coordinator: "agents/coordinator.md",
                db: "agents/db-agent.md",
                backend: "agents/backend-agent.md",
                frontend: "agents/frontend-agent.md",
                design: "agents/design-agent.md"
            } as const;

            const content = await readText(fileMap[agent]);

            return {
                content: [
                    {
                        type: "text",
                        text: content
                    }
                ]
            };
        }
    );

    server.registerTool(
        "read_artifact",
        {
            description: "Read an artifact from artifacts folder",
            inputSchema: z.object({
                path: z.string().startsWith("artifacts/")
            })
        },
        async ({ path }) => {
            const content = await readText(path);

            return {
                content: [
                    {
                        type: "text",
                        text: content
                    }
                ]
            };
        }
    );

    server.registerTool(
        "write_artifact",
        {
            description: "Write an artifact into artifacts folder",
            inputSchema: z.object({
                path: z.string().startsWith("artifacts/"),
                content: z.string()
            })
        },
        async ({ path, content }) => {
            const savedPath = await writeText(path, content);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            ok: true,
                            path: savedPath
                        })
                    }
                ]
            };
        }
    );

    server.registerTool(
        "list_artifacts",
        {
            description: "List all artifact files",
            inputSchema: z.object({})
        },
        async () => {
            const files = await listFiles("artifacts");

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            files
                        }, null, 2)
                    }
                ]
            };
        }
    );

    server.registerTool(
        "report_conflict",
        {
            description: "Append a conflict to conflict-log.md",
            inputSchema: z.object({
                title: z.string(),
                description: z.string(),
                relatedFiles: z.array(z.string())
            })
        },
        async ({ title, description, relatedFiles }) => {
            const entry = `
## ${title}

${description}

Related files:
${relatedFiles.map((file) => `- ${file}`).join("\n")}

---
`;

            await appendText("artifacts/conflicts/conflict-log.md", entry);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            ok: true
                        })
                    }
                ]
            };
        }
    );

    server.registerTool(
        "mark_task_done",
        {
            description: "Append a completed task to task-board.md",
            inputSchema: z.object({
                agent: z.enum([
                    "coordinator",
                    "db",
                    "backend",
                    "frontend",
                    "design"
                ]),
                task: z.string()
            })
        },
        async ({ agent, task }) => {
            const entry = `\n- [x] ${agent}: ${task}`;
            await appendText("artifacts/coordinator/task-board.md", entry);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            ok: true
                        })
                    }
                ]
            };
        }
    );

    return server;
}

void serveStdio(createServer);

console.error("legal lookup MCP server running on stdio");