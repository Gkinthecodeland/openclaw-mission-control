export function isValidPackageName(name: string): boolean {
  if (!name || name.length > 128) return false;
  return /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(name);
}

export const ALLOWED_TAILSCALE_COMMANDS = new Set([
  "status", "ip", "version", "ping", "dns", "whois", "netcheck"
]);

export const BLOCKED_TAILSCALE_ARGS = [
  "auth-key", "--auth-key", "--advertise", "--exit-node",
  "--operator", "--accept-routes", "--shields-up"
];
