import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { type: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    if (args.type) {
      return await ctx.db.query("activities").withIndex("by_type", (q) => q.eq("type", args.type!)).order("desc").take(limit);
    }
    return await ctx.db.query("activities").withIndex("by_timestamp").order("desc").take(limit);
  },
});

export const create = mutation({
  args: { type: v.string(), source: v.string(), message: v.string(), severity: v.union(v.literal("info"), v.literal("warn"), v.literal("error"), v.literal("success")), timestamp: v.number() },
  handler: async (ctx, args) => { return await ctx.db.insert("activities", args); },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => { const all = await ctx.db.query("activities").collect(); await Promise.all(all.map((doc) => ctx.db.delete(doc._id))); },
});
