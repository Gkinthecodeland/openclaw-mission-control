import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { getDefaultWorkspace } from "@/lib/paths";
import { notifyKanbanUpdated } from "@/lib/kanban-live";
import { notifyWarRoom } from "@/lib/warroom-live";
import { verifyAuth, unauthorizedResponse } from "@/lib/auth";

async function getKanbanPath(): Promise<string> {
  const ws = await getDefaultWorkspace();
  return join(ws, "kanban.json");
}

/* ── PATCH — atomic partial task update ──────────── */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAuth(request)) return unauthorizedResponse();

  try {
    const { id: idStr } = await params;
    const taskId = parseInt(idStr, 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const changes = await request.json();
    const kanbanPath = await getKanbanPath();
    const raw = await readFile(kanbanPath, "utf-8");
    const data = JSON.parse(raw);

    const taskIndex = data.tasks.findIndex((t: { id: number }) => t.id === taskId);
    if (taskIndex === -1) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const oldTask = data.tasks[taskIndex];
    const fromColumn = oldTask.column;

    // Merge changes
    data.tasks[taskIndex] = { ...oldTask, ...changes, updatedAt: Date.now() };

    await writeFile(kanbanPath, JSON.stringify(data, null, 2), "utf-8");

    // Notify both kanban (backward compat) and War Room streams
    notifyKanbanUpdated();

    if (changes.column && changes.column !== fromColumn) {
      notifyWarRoom({
        type: "task-moved",
        taskId,
        fromColumn,
        toColumn: changes.column,
      });
    }
    if (changes.assignedAgent) {
      notifyWarRoom({
        type: "task-assigned",
        taskId,
        agentId: changes.assignedAgent,
      });
    }
    notifyWarRoom({
      type: "task-updated",
      taskId,
      changes,
    });

    return NextResponse.json({ ok: true, task: data.tasks[taskIndex] });
  } catch (err) {
    console.error("Task PATCH error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
