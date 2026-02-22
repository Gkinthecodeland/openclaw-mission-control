import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { status: v.optional(v.union(v.literal("suggested"), v.literal("approved"), v.literal("rejected"), v.literal("completed"))), domain: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.status) return await ctx.db.query("tasks").withIndex("by_status", (q) => q.eq("status", args.status!)).order("desc").collect();
    if (args.domain) return await ctx.db.query("tasks").withIndex("by_domain", (q) => q.eq("domain", args.domain!)).order("desc").collect();
    return await ctx.db.query("tasks").order("desc").collect();
  },
});

export const create = mutation({
  args: { title: v.string(), domain: v.string(), priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")), status: v.union(v.literal("suggested"), v.literal("approved"), v.literal("rejected"), v.literal("completed")), assignee: v.optional(v.string()), description: v.optional(v.string()), createdAt: v.number(), updatedAt: v.optional(v.number()) },
  handler: async (ctx, args) => { return await ctx.db.insert("tasks", args); },
});

export const updateStatus = mutation({
  args: { id: v.id("tasks"), status: v.union(v.literal("suggested"), v.literal("approved"), v.literal("rejected"), v.literal("completed")) },
  handler: async (ctx, args) => { await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() }); },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => { await ctx.db.delete(args.id); },
});
