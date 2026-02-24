export type AgentActivity = "typing" | "thinking" | "idle" | "sleeping" | "walking";

export type OfficeAgent = {
  id: string;
  name: string;
  emoji: string;
  status: "active" | "idle" | "unknown";
  activity: AgentActivity;
  color: { primary: string; secondary: string; skin: string };
  deskIndex: number;
  currentTask: string | null;
};
