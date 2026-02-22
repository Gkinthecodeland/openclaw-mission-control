import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { startTime: v.optional(v.number()), endTime: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = ctx.db.query("calendarEvents").withIndex("by_start");
    if (args.startTime !== undefined && args.endTime !== undefined) {
      return await q.filter((doc) => doc.and(doc.gte(doc.field("startTime"), args.startTime!), doc.lte(doc.field("startTime"), args.endTime!))).order("asc").collect();
    }
    return await q.order("asc").collect();
  },
});

export const create = mutation({
  args: { title: v.string(), startTime: v.number(), endTime: v.number(), category: v.string(), color: v.optional(v.string()), completed: v.optional(v.boolean()) },
  handler: async (ctx, args) => { return await ctx.db.insert("calendarEvents", args); },
});

export const update = mutation({
  args: { id: v.id("calendarEvents"), title: v.optional(v.string()), startTime: v.optional(v.number()), endTime: v.optional(v.number()), category: v.optional(v.string()), color: v.optional(v.string()), completed: v.optional(v.boolean()) },
  handler: async (ctx, args) => { const { id, ...patch } = args; const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)); await ctx.db.patch(id, cleaned); },
});

export const remove = mutation({
  args: { id: v.id("calendarEvents") },
  handler: async (ctx, args) => { await ctx.db.delete(args.id); },
});
