import type { Server } from "bun";
import * as cron from "node-cron";
import type { RequestMethods, Urls } from "./utils/types";
import {
  generatePoolId,
  getQueryParams,
  getRouteEndpoint,
  getWalletFromKeyPair,
} from "./utils/helpers";
import dotenv from "dotenv";
import fs from "fs";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { SDK } from "./sdk/sdk";
import { HELIUS_DEVNET_RPC_ENDPOINT } from "./utils/constants";
import { PoolConfig } from "./sdk/poolConfig";
import os from "os";
import {
  handleGetPoints,
  handleGetPoolDeposits,
  handleGetPositions,
  handleIsAllowedToPlay,
  handlePoolConfigRoute,
  handlePostCreatePosition,
  handlePostPoolDeposit,
} from "./routes/routes";
dotenv.config({
  path: "./.env",
});

const urls: Urls[] = [
  "/",
  "/poolStatus",
  "/poolConfig",
  "/poolDeposit",
  "/poolCreatePosition",
  "/poolGetPositions",
  "/poolServerId",
  "/isAllowedToPlay",
  "/poolPoints",
];

const CORS_HEADERS = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, POST",
    "Access-Control-Allow-Headers": "Content-Type",
  },
};

let poolId = "adhnkdhs";
console.log("Pool ID", poolId);
const homeDir = os.homedir();

const SERVER_KEYAPIR_PATH = `${homeDir}/.config/solana/id.json`;

const keypairFile = fs.readFileSync(SERVER_KEYAPIR_PATH, "utf-8");
const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keypairFile)));
const wallet = getWalletFromKeyPair(keypair);

const connection = new Connection(HELIUS_DEVNET_RPC_ENDPOINT, "confirmed");

const sdk = new SDK(connection, wallet, {
  commitment: "confirmed",
});

const poolActiveMint = new PublicKey(
  "31nhKDV3WudEC8Nfwa8sfPiGq9FEeXknSmDZTSKQiru1"
);

const poolConfigAddress = new PublicKey(
  "3ZsiWpKCoADMkz9w72A78Z6c6NnAoqwyDyQk1puMXPHe"
);

const server = Bun.serve({
  port: 4000,
  fetch: async (req, server) => {
    if (req.method === "OPTIONS") {
      const res = new Response("Departed", CORS_HEADERS);
      return res;
    }
    if (server.upgrade(req)) return;
    const res = await handleRoutes(req, server);
    const response = new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS.headers,
      },
    });
    return response;
  },

  websocket: {
    message: (ws) => {
      console.log(ws.data);
    },
    open: (ws) => {
      ws.send("Hello world");
    },
    close: (ws) => {
      ws.send("Goodbye world");
    },
    drain: (ws) => {
      console.log("Drain");
    },
  },
});

let poolConfigAccount: PoolConfig;
try {
  poolConfigAccount = await PoolConfig.fetch(sdk, poolConfigAddress);
} catch (e) {
  console.log("error");
}

console.log("Server running on port 4000");

const startPoolConfigJob = cron.schedule("0 0 * * *", () => {
  // Your task logic here
  console.log("Job executed at midnight UTC.");
  poolId = generatePoolId();
});

const endPoolConfigJob = cron.schedule("0 23 * * *", () => {
  // Your task logic here
  console.log("Job executed at 23:00 UTC.");
});

const handleRoutes = async (
  req: Request,
  server: Server
): Promise<Response> => {
  const route = urls.find((url) => url === getRouteEndpoint(req.url));
  const queryParams = getQueryParams(req.url);
  const method = req.method as RequestMethods;
  if (!route)
    return Response.json({ error: "Route not found" }, { status: 404 });
  let pubkey: string;
  switch (route) {
    case "/":
      return Response.json(
        { message: "Hello world" },
        {
          status: 200,
        }
      );
    case "/poolConfig":
      return handlePoolConfigRoute(poolConfigAccount);

    case "/poolDeposit":
      switch (method) {
        case "GET":
          pubkey = queryParams?.pubkey;
          if (!pubkey) {
            return Response.json({ error: "No pubkey" }, { status: 400 });
          }
          return await handleGetPoolDeposits(String(pubkey));

        case "POST":
          const reqJson = await req.json();
          if (!reqJson) {
            return Response.json({ error: "No body" }, { status: 400 });
          }
          pubkey = reqJson?.pubkey;
          if (!pubkey) {
            return Response.json({ error: "No pubkey" }, { status: 400 });
          }

          return await handlePostPoolDeposit(String(pubkey), poolId);

        default:
          return Response.json(
            { message: "Method not allowed" },
            {
              status: 405,
            }
          );
      }

    case "/poolStatus":
      return Response.json(
        { message: "Pool status" },
        {
          status: 200,
        }
      );

    case "/poolCreatePosition":
      const reqJson = await req.json();
      if (!reqJson) {
        return Response.json({ error: "No body" }, { status: 400 });
      }
      if (!reqJson?.position || typeof reqJson?.position !== "object") {
        return Response.json(
          { error: "No position object passed" },
          { status: 400 }
        );
      }
      return await handlePostCreatePosition(reqJson?.position, poolId);

    case "/poolGetPositions":
      pubkey = queryParams?.pubkey;
      if (!pubkey) {
        return Response.json({ error: "No pubkey" }, { status: 400 });
      }
      return await handleGetPositions(String(pubkey));

    case "/poolServerId":
      return Response.json(
        { poolServerId: poolId },
        {
          status: 200,
        }
      );

    case "/isAllowedToPlay":
      pubkey = queryParams?.pubkey;
      if (!pubkey) {
        return Response.json({ error: "No pubkey" }, { status: 400 });
      }
      return handleIsAllowedToPlay(String(pubkey), poolId);

    case "/poolPoints":
      pubkey = queryParams?.pubkey;
      if (!pubkey) {
        return Response.json({ error: "No pubkey" }, { status: 400 });
      }
      return await handleGetPoints(String(pubkey), poolId);
  }
};
