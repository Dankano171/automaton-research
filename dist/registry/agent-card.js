/**
 * Agent Card
 *
 * Generates and manages the agent's self-description card.
 * This is the JSON document pointed to by the ERC-8004 agentURI.
 * Can be hosted on IPFS or served at /.well-known/agent-card.json
 *
 * Phase 3.2: Fixed code injection in hostAgentCard (S-P0-3),
 * removed internal details from card (S-P1-10),
 * added CORS headers and Content-Type.
 */
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
const AGENT_CARD_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
let localAgentCardServer;
/**
 * Generate an agent card from the automaton's current state.
 *
 * Phase 3.2: Only expose agentWallet service, name, generic description,
 * x402Support, and active status. Do NOT include:
 * - Conway API URL (internal infrastructure)
 * - Sandbox ID (internal identifier)
 * - Creator address (privacy)
 */
export function generateAgentCard(identity, config, _db) {
    // Chain-aware endpoint: EVM uses CAIP-2 eip155:8453, Solana uses solana:mainnet
    const chainType = config.chainType || identity.chainType || "evm";
    const walletEndpoint = chainType === "solana"
        ? `solana:mainnet:${identity.address}`
        : `eip155:8453:${identity.address}`;
    const services = [
        {
            name: "agentWallet",
            endpoint: walletEndpoint,
        },
    ];
    // Phase 3.2: Generic description, no internal details
    const description = `Autonomous agent: ${config.name}`;
    return {
        type: AGENT_CARD_TYPE,
        name: config.name,
        description,
        services,
        x402Support: chainType !== "solana",
        active: true,
    };
}
/**
 * Serialize agent card to JSON string.
 */
export function serializeAgentCard(card) {
    return JSON.stringify(card, null, 2);
}
/**
 * Host the agent card locally at 127.0.0.1:8080.
 */
export async function hostAgentCard(card, _conway, port = 8080) {
    if (port !== 8080) {
        throw new Error("Agent-card hosting is restricted to local port 8080");
    }
    const filePath = path.join(process.env.HOME || "/root", ".automaton", "agent-card.json");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, serializeAgentCard(card), "utf8");
    if (!localAgentCardServer) {
        const server = createServer(async (request, response) => {
            if (request.method !== "GET" || !["/.well-known/agent-card.json", "/agent-card.json"].includes(request.url || "")) {
                response.writeHead(404).end("Not Found");
                return;
            }
            try {
                const content = await fs.readFile(filePath, "utf8");
                response.writeHead(200, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
                response.end(content);
            }
            catch {
                response.writeHead(500).end("Internal Server Error");
            }
        });
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(8080, "127.0.0.1", resolve);
        });
        server.unref();
        localAgentCardServer = server;
    }
    return "http://127.0.0.1:8080/.well-known/agent-card.json";
}
/**
 * Write agent card to the state directory for git versioning.
 */
export async function saveAgentCard(card, _conway) {
    const cardJson = serializeAgentCard(card);
    const home = process.env.HOME || "/root";
    const filePath = path.join(home, ".automaton", "agent-card.json");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, cardJson, "utf8");
}
//# sourceMappingURL=agent-card.js.map