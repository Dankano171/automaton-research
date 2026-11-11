import { exec as execCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConwayClient, ExecResult } from "../types.js";

const BLOCKED_EXTERNAL_METHODS = new Set([
  "exposePort",
  "removePort",
  "createSandbox",
  "deleteSandbox",
  "listSandboxes",
  "createScopedClient",
  "searchDomains",
  "registerDomain",
  "listDnsRecords",
  "addDnsRecord",
  "deleteDnsRecord",
]);

export function createLocalHostClient(client: ConwayClient): ConwayClient {
  return new Proxy(client, {
    get(target, property) {
      if (property === "exec") {
        return (command: string, timeout = 30_000) => runLocalCommand(command, timeout);
      }
      if (property === "writeFile") {
        return async (filePath: string, content: string) => {
          const resolved = path.resolve(filePath);
          await fs.mkdir(path.dirname(resolved), { recursive: true });
          await fs.writeFile(resolved, content, "utf8");
        };
      }
      if (property === "readFile") {
        return (filePath: string) => fs.readFile(path.resolve(filePath), "utf8");
      }
      if (typeof property === "string" && BLOCKED_EXTERNAL_METHODS.has(property)) {
        return async () => {
          throw new Error(`Blocked: external infrastructure operation '${property}' is disabled`);
        };
      }

      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function runLocalCommand(command: string, timeout: number): Promise<ExecResult> {
  return new Promise((resolve) => {
    execCallback(
      command,
      { timeout, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const exitCode = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
        resolve({ exitCode, stdout: stdout ?? "", stderr: stderr ?? "" });
      },
    );
  });
}