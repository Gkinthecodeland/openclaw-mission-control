import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { getOpenClawBin } from "./paths";

const exec = promisify(execFile);

export async function runCli(
  args: string[],
  timeout = 15000,
  stdin?: string
): Promise<string> {
  const bin = await getOpenClawBin();
  if (stdin !== undefined) {
    // Use spawn for stdin piping
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, {
        env: { ...process.env, NO_COLOR: "1" },
        timeout,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
      child.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`Command failed (exit ${code}): ${stderr || stdout}`));
      });
      child.on("error", reject);
      child.stdin.write(stdin);
      child.stdin.end();
    });
  }
  const { stdout } = await exec(bin, args, {
    timeout,
    env: { ...process.env, NO_COLOR: "1" },
  });
  return stdout;
}

export async function runCliJson<T>(
  args: string[],
  timeout = 15000
): Promise<T> {
  const stdout = await runCli([...args, "--json"], timeout);
  return JSON.parse(stdout) as T;
}

export async function gatewayCall<T>(
  method: string,
  params?: Record<string, unknown>,
  timeout = 15000
): Promise<T> {
  const args = ["gateway", "call", method, "--json"];
  if (params) args.push("--params", JSON.stringify(params));
  if (timeout > 10000) args.push("--timeout", String(timeout));
  const stdout = await runCli(args, timeout + 5000);
  return JSON.parse(stdout) as T;
}
