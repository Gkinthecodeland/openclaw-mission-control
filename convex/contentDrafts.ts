import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {
    status: v.optional(v.union(v.literal("idea"), v.literal("drafting"), v.literal("review"), v.literal("scheduled"), v.literal("published"))),
    type: v.optional(v.union(v.literal("blog"), v.literal("social"), v.literal("email"), v.literal("video"), v.literal("doc"))),
  },
  handler: async (ctx, args) => {
    if (args.status) return await ctx.db.query("contentDrafts").withIndex("by_status", (q) => q.eq("status", args.status!)).order("desc").collect();
    if (args.type) return await ctx.db.query("contentDrafts").withIndex("by_type", (q) => q.eq("type", args.type!)).order("desc").collect();
    return await ctx.db.query("contentDrafts").order("desc").collect();
  },
});

export const create = mutation({
  args: { title: v.string(), type: v.union(v.literal("blog"), v.literal("social"), v.literal("email"), v.literal("video"), v.literal("doc")), status: v.union(v.literal("idea"), v.literal("drafting"), v.literal("review"), v.literal("scheduled"), v.literal("published")), content: v.optional(v.string()), author: v.optional(v.string()), tags: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => { return await ctx.db.insert("contentDrafts", { ...args, createdAt: Date.now() }); },
});

export const updateStatus = mutation({
  args: { id: v.id("contentDrafts"), status: v.union(v.literal("idea"), v.literal("drafting"), v.literal("review"), v.literal("scheduled"), v.literal("published")) },
  handler: async (ctx, args) => { return await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() }); },
});

export const remove = mutation({
  args: { id: v.id("contentDrafts") },
  handler: async (ctx, args) => { return await ctx.db.delete(args.id); },
});
