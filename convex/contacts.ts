import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {
    type: v.optional(v.union(v.literal("client"), v.literal("lead"), v.literal("partner"), v.literal("vendor"))),
    stage: v.optional(v.union(v.literal("prospect"), v.literal("contacted"), v.literal("negotiation"), v.literal("won"), v.literal("lost"))),
  },
  handler: async (ctx, args) => {
    if (args.type) return await ctx.db.query("contacts").withIndex("by_type", (q) => q.eq("type", args.type!)).collect();
    if (args.stage) return await ctx.db.query("contacts").withIndex("by_stage", (q) => q.eq("stage", args.stage!)).collect();
    return await ctx.db.query("contacts").collect();
  },
});

export const create = mutation({
  args: { name: v.string(), company: v.optional(v.string()), type: v.union(v.literal("client"), v.literal("lead"), v.literal("partner"), v.literal("vendor")), stage: v.union(v.literal("prospect"), v.literal("contacted"), v.literal("negotiation"), v.literal("won"), v.literal("lost")), notes: v.optional(v.string()), value: v.optional(v.number()), tags: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => { return await ctx.db.insert("contacts", args); },
});

export const update = mutation({
  args: { id: v.id("contacts"), name: v.optional(v.string()), company: v.optional(v.string()), type: v.optional(v.union(v.literal("client"), v.literal("lead"), v.literal("partner"), v.literal("vendor"))), stage: v.optional(v.union(v.literal("prospect"), v.literal("contacted"), v.literal("negotiation"), v.literal("won"), v.literal("lost"))), notes: v.optional(v.string()), value: v.optional(v.number()), tags: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => { const { id, ...fields } = args; const filtered = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)); return await ctx.db.patch(id, filtered); },
});

export const remove = mutation({
  args: { id: v.id("contacts") },
  handler: async (ctx, args) => { return await ctx.db.delete(args.id); },
});
