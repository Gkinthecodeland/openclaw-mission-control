import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  activities: defineTable({
    type: v.string(),
    source: v.string(),
    message: v.string(),
    severity: v.union(v.literal("info"), v.literal("warn"), v.literal("error"), v.literal("success")),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]).index("by_type", ["type"]),

  calendarEvents: defineTable({
    title: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    category: v.string(),
    color: v.optional(v.string()),
    completed: v.optional(v.boolean()),
  }).index("by_start", ["startTime"]).index("by_category", ["category"]),

  tasks: defineTable({
    title: v.string(),
    domain: v.string(),
    priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    status: v.union(v.literal("suggested"), v.literal("approved"), v.literal("rejected"), v.literal("completed")),
    assignee: v.optional(v.string()),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_status", ["status"]).index("by_domain", ["domain"]),

  contacts: defineTable({
    name: v.string(),
    company: v.optional(v.string()),
    type: v.union(v.literal("client"), v.literal("lead"), v.literal("partner"), v.literal("vendor")),
    stage: v.union(v.literal("prospect"), v.literal("contacted"), v.literal("negotiation"), v.literal("won"), v.literal("lost")),
    notes: v.optional(v.string()),
    value: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  }).index("by_type", ["type"]).index("by_stage", ["stage"]),

  contentDrafts: defineTable({
    title: v.string(),
    type: v.union(v.literal("blog"), v.literal("social"), v.literal("email"), v.literal("video"), v.literal("doc")),
    status: v.union(v.literal("idea"), v.literal("drafting"), v.literal("review"), v.literal("scheduled"), v.literal("published")),
    content: v.optional(v.string()),
    author: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_status", ["status"]).index("by_type", ["type"]),

  ecosystemProducts: defineTable({
    slug: v.string(),
    name: v.string(),
    tagline: v.string(),
    icon: v.string(),
    color: v.string(),
    status: v.union(v.literal("active"), v.literal("development"), v.literal("planned"), v.literal("archived")),
    techStack: v.array(v.string()),
    links: v.optional(v.any()),
    metrics: v.optional(v.any()),
  }).index("by_slug", ["slug"]).index("by_status", ["status"]),
});
