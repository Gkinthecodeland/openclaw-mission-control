import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { status: v.optional(v.union(v.literal("active"), v.literal("development"), v.literal("planned"), v.literal("archived"))) },
  handler: async (ctx, args) => {
    if (args.status) return await ctx.db.query("ecosystemProducts").withIndex("by_status", (q) => q.eq("status", args.status!)).collect();
    return await ctx.db.query("ecosystemProducts").collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => { return await ctx.db.query("ecosystemProducts").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique(); },
});

export const create = mutation({
  args: { slug: v.string(), name: v.string(), tagline: v.string(), icon: v.string(), color: v.string(), status: v.union(v.literal("active"), v.literal("development"), v.literal("planned"), v.literal("archived")), techStack: v.array(v.string()), links: v.optional(v.any()), metrics: v.optional(v.any()) },
  handler: async (ctx, args) => { return await ctx.db.insert("ecosystemProducts", args); },
});

export const update = mutation({
  args: { id: v.id("ecosystemProducts"), name: v.optional(v.string()), tagline: v.optional(v.string()), icon: v.optional(v.string()), color: v.optional(v.string()), status: v.optional(v.union(v.literal("active"), v.literal("development"), v.literal("planned"), v.literal("archived"))), techStack: v.optional(v.array(v.string())), links: v.optional(v.any()), metrics: v.optional(v.any()) },
  handler: async (ctx, args) => { const { id, ...fields } = args; const filtered = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)); return await ctx.db.patch(id, filtered); },
});
