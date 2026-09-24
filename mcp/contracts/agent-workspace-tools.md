# Agent Workspace MCP Tools

## 1. read_project_brief

Purpose:
Read the main project brief.

Input:
{}

Output:
{
  "content": "string"
}

Reads:
project/brief.md

---

## 2. read_agent_role

Purpose:
Read the role instruction of one agent.

Input:
{
  "agent": "coordinator" | "db" | "backend" | "frontend" | "design"
}

Output:
{
  "content": "string"
}

Reads:
agents/coordinator.md
agents/db-agent.md
agents/backend-agent.md
agents/frontend-agent.md
agents/design-agent.md

---

## 3. write_artifact

Purpose:
Write an artifact into the correct agent folder.

Input:
{
  "path": "string",
  "content": "string"
}

Output:
{
  "ok": true,
  "path": "string"
}

Allowed write paths:
artifacts/design/**
artifacts/db/**
artifacts/backend/**
artifacts/frontend/**
artifacts/coordinator/**
artifacts/conflicts/**

---

## 4. read_artifact

Purpose:
Read an existing artifact.

Input:
{
  "path": "string"
}

Output:
{
  "content": "string"
}

Reads:
artifacts/**

---

## 5. list_artifacts

Purpose:
List all artifacts currently created.

Input:
{}

Output:
{
  "files": ["string"]
}

Reads:
artifacts/**

---

## 6. report_conflict

Purpose:
Append a conflict to conflict-log.md.

Input:
{
  "title": "string",
  "description": "string",
  "relatedFiles": ["string"]
}

Output:
{
  "ok": true
}

Writes:
artifacts/conflicts/conflict-log.md

---

## 7. mark_task_done

Purpose:
Mark one agent task as done.

Input:
{
  "agent": "db" | "backend" | "frontend" | "design" | "coordinator",
  "task": "string"
}

Output:
{
  "ok": true
}

Writes:
artifacts/coordinator/task-board.md