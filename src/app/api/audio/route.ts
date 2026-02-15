import { NextRequest, NextResponse } from "next/server";
import { gatewayCall, runCli } from "@/lib/openclaw-cli";
import { readFile, stat } from "fs/promises";
import { extname } from "path";

/**
 * Ask the OpenClaw agent to generate a short, unique TTS test phrase.
 * Falls back to a dynamic template if the agent is unavailable.
 */
async function generateTestPhrase(): Promise<string> {
  try {
    const output = await runCli(
      [
        "agent", "--agent", "main", "--message",
        "Generate a single short sentence (max 20 words) for me to test my text-to-speech system. " +
        "Make it fun, unique, and self-aware — you're an AI assistant named OpenClaw. " +
        "Don't add quotes or explanation, just the sentence.",
      ],
      15000
    );
    const phrase = output.trim();
    // Sanity check: should be a short phrase, not an essay
    if (phrase && phrase.length > 5 && phrase.length < 300) {
      return phrase;
    }
  } catch {
    // Agent unavailable — fall through to template
  }

  // Fallback: dynamic rotating phrases
  const phrases = [
    "Hey there, it's OpenClaw. I can talk now — isn't that something?",
    "This is your friendly neighborhood AI, doing a quick voice check. Sounding good?",
    "OpenClaw online and speaking. If you can hear this, we're in business.",
    "Voice systems nominal. This is OpenClaw, live and in stereo.",
    "Greetings from the other side of the speaker. OpenClaw, at your service.",
    "Testing, testing, one two three. OpenClaw's got its voice on.",
    "If I sound this good on a test, imagine what I'll sound like with something important to say.",
    "This is OpenClaw. I've read the docs so you don't have to. You're welcome.",
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

/**
 * GET /api/audio - Returns TTS status, providers, and config.
 *
 * Query: scope=status (default) | providers | stream
 *        path=<filepath>  (required for scope=stream)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") || "status";

  try {
    // Stream an audio file for playback
    if (scope === "stream") {
      const filePath = searchParams.get("path") || "";
      if (!filePath) {
        return NextResponse.json({ error: "path required" }, { status: 400 });
      }
      // Security: only allow temp directory audio files
      if (!filePath.startsWith("/tmp/") && !filePath.includes("/T/tts-") && !filePath.includes("/tmp/")) {
        return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
      }
      try {
        const info = await stat(filePath);
        const ext = extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "audio/mpeg";
        const buffer = await readFile(filePath);
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Length": info.size.toString(),
            "Cache-Control": "no-cache",
          },
        });
      } catch {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    }

    if (scope === "providers") {
      const providers = await gatewayCall<Record<string, unknown>>(
        "tts.providers",
        undefined,
        10000
      );
      return NextResponse.json(providers);
    }

    // Default: full status + providers + config
    const [status, providers, configData] = await Promise.all([
      gatewayCall<Record<string, unknown>>("tts.status", undefined, 10000),
      gatewayCall<Record<string, unknown>>("tts.providers", undefined, 10000),
      gatewayCall<Record<string, unknown>>("config.get", undefined, 10000),
    ]);

    // Extract relevant config sections
    const resolved = (configData.resolved || {}) as Record<string, unknown>;
    const parsed = (configData.parsed || {}) as Record<string, unknown>;

    const resolvedMessages = (resolved.messages || {}) as Record<string, unknown>;
    const resolvedTts = (resolvedMessages.tts || {}) as Record<string, unknown>;
    const resolvedTalk = (resolved.talk || {}) as Record<string, unknown>;
    const resolvedTools = (resolved.tools || {}) as Record<string, unknown>;
    const resolvedMedia = (resolvedTools.media || {}) as Record<string, unknown>;
    const resolvedAudio = (resolvedMedia.audio || {}) as Record<string, unknown>;

    const parsedMessages = (parsed.messages || {}) as Record<string, unknown>;
    const parsedTts = parsedMessages.tts as Record<string, unknown> | undefined;
    const parsedTalk = parsed.talk as Record<string, unknown> | undefined;
    const parsedMedia = ((parsed.tools || {}) as Record<string, unknown>).media as
      | Record<string, unknown>
      | undefined;

    // Read TTS user preferences if available
    let prefs: Record<string, unknown> | null = null;
    const prefsPath = (status.prefsPath as string) || "";
    if (prefsPath) {
      try {
        const raw = await readFile(prefsPath, "utf-8");
        prefs = JSON.parse(raw);
      } catch {
        // prefs file may not exist
      }
    }

    return NextResponse.json({
      status,
      providers,
      config: {
        tts: {
          resolved: resolvedTts,
          parsed: parsedTts || null,
        },
        talk: {
          resolved: resolvedTalk,
          parsed: parsedTalk || null,
        },
        audioUnderstanding: {
          resolved: resolvedAudio,
          parsed: parsedMedia || null,
        },
      },
      prefs,
      configHash: configData.hash || null,
    });
  } catch (err) {
    console.error("Audio API GET error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/audio - Audio/TTS management actions.
 *
 * Body:
 *   { action: "enable" }
 *   { action: "disable" }
 *   { action: "set-provider", provider: "openai" | "elevenlabs" | "edge" }
 *   { action: "test", text: "Hello world" }
 *   { action: "update-config", section: "tts" | "talk", config: { ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case "set-auto-mode": {
        // Set auto-TTS mode via config patch (most reliable method)
        const mode = body.mode as string;
        if (!["off", "always", "inbound", "tagged"].includes(mode)) {
          return NextResponse.json(
            { error: `Invalid mode: ${mode}. Use off, always, inbound, or tagged.` },
            { status: 400 }
          );
        }
        try {
          const configData = await gatewayCall<Record<string, unknown>>(
            "config.get", undefined, 10000
          );
          const hash = configData.hash as string;
          await gatewayCall(
            "config.patch",
            { raw: JSON.stringify({ messages: { tts: { auto: mode } } }), baseHash: hash },
            15000
          );
          return NextResponse.json({ ok: true, action, mode });
        } catch (err) {
          return NextResponse.json(
            { ok: false, error: "Could not update auto-TTS mode. Is the gateway running?" },
            { status: 502 }
          );
        }
      }

      case "enable":
      case "disable": {
        // Try RPC first, fall back to config patch
        try {
          const result = await gatewayCall<Record<string, unknown>>(
            action === "enable" ? "tts.enable" : "tts.disable",
            undefined,
            8000
          );
          return NextResponse.json({ ok: true, action, ...result });
        } catch {
          // Fallback: patch config directly
          try {
            const configData = await gatewayCall<Record<string, unknown>>(
              "config.get", undefined, 10000
            );
            const hash = configData.hash as string;
            const auto = action === "enable" ? "always" : "off";
            await gatewayCall(
              "config.patch",
              { raw: JSON.stringify({ messages: { tts: { auto } } }), baseHash: hash },
              15000
            );
            return NextResponse.json({ ok: true, action, fallback: true });
          } catch {
            return NextResponse.json(
              { ok: false, error: "Could not reach the gateway. Make sure it is running." },
              { status: 502 }
            );
          }
        }
      }

      case "set-provider": {
        const provider = body.provider as string;
        if (!provider) {
          return NextResponse.json(
            { error: "provider is required" },
            { status: 400 }
          );
        }
        try {
          const result = await gatewayCall<Record<string, unknown>>(
            "tts.setProvider",
            { provider },
            10000
          );
          return NextResponse.json({ ok: true, action, provider, ...result });
        } catch {
          // Fallback: patch config
          try {
            const configData = await gatewayCall<Record<string, unknown>>(
              "config.get", undefined, 10000
            );
            const hash = configData.hash as string;
            await gatewayCall(
              "config.patch",
              { raw: JSON.stringify({ messages: { tts: { provider } } }), baseHash: hash },
              15000
            );
            return NextResponse.json({ ok: true, action, provider, fallback: true });
          } catch {
            return NextResponse.json(
              { ok: false, error: "Could not set provider. Is the gateway running?" },
              { status: 502 }
            );
          }
        }
      }

      case "test": {
        // Use explicit text if provided, otherwise ask the agent for a unique phrase
        const text = (body.text as string) || await generateTestPhrase();
        const params: Record<string, unknown> = { text };
        if (body.provider) params.provider = body.provider;
        if (body.voice) params.voice = body.voice;
        if (body.model) params.model = body.model;

        try {
          const result = await gatewayCall<Record<string, unknown>>(
            "tts.convert",
            params,
            30000
          );
          return NextResponse.json({ ok: true, action, text, ...result });
        } catch {
          return NextResponse.json(
            { ok: false, error: "TTS generation failed. Check that the gateway is running and the provider has a valid API key." },
            { status: 502 }
          );
        }
      }

      case "update-config": {
        const section = body.section as string;
        const config = body.config as Record<string, unknown>;
        if (!section || !config) {
          return NextResponse.json(
            { error: "section and config required" },
            { status: 400 }
          );
        }

        try {
          const configData = await gatewayCall<Record<string, unknown>>(
            "config.get", undefined, 10000
          );
          const hash = configData.hash as string;

          let patchRaw: string;
          if (section === "tts") {
            patchRaw = JSON.stringify({ messages: { tts: config } });
          } else if (section === "talk") {
            patchRaw = JSON.stringify({ talk: config });
          } else if (section === "audio") {
            patchRaw = JSON.stringify({ tools: { media: { audio: config } } });
          } else {
            return NextResponse.json(
              { error: `Unknown section: ${section}` },
              { status: 400 }
            );
          }

          await gatewayCall(
            "config.patch",
            { raw: patchRaw, baseHash: hash },
            15000
          );
          return NextResponse.json({ ok: true, action, section });
        } catch {
          return NextResponse.json(
            { ok: false, error: `Could not update ${section} config. Is the gateway running?` },
            { status: 502 }
          );
        }
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("Audio API POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
