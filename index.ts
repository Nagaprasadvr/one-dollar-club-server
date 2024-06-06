import * as cron from "node-cron";
import type { RequestMethods, Urls } from "./utils/types";
import {
  execCalculateLeaderBoardJob,
  fetchAndSetPoolId,
  getQueryParams,
  getRouteEndpoint,
  getWalletFromKeyPair,
  getWinner,
  updateExistingPoolId,
} from "./utils/helpers";
import dotenv from "dotenv";
import fs from "fs";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { SDK } from "./sdk/sdk";
import { authHash, HELIUS_DEVNET_RPC_ENDPOINT } from "./utils/constants";
import { PoolConfig } from "./sdk/poolConfig";
import os from "os";
import {
  handleGetLeaderboard,
  handleGetPoints,
  handleGetPoolDeposits,
  handleGetPositions,
  handleGetPositionsStat,
  handleIsAllowedToPlay,
  handlePoolConfigRoute,
  handlePostCreatePosition,
  handlePostCreatePositions,
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
  "/poolCreatePositions",
  "/leaderBoard",
  "/getPositionsStat",
  "/changePoolIdByAuthority",
];

const CORS_HEADERS = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, POST,GET",
    "Access-Control-Allow-Headers": "Content-Type",
  },
};

let poolId = await fetchAndSetPoolId();
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
  "7d9QiPPQ4q9DV4UyLS3j9ZSR71NRwCQ4NMYeHaCkXByz"
);

const server = Bun.serve({
  port: 4000,
  fetch: async (req, server) => {
    if (req.method === "OPTIONS") {
      const res = new Response("Departed", CORS_HEADERS);
      return res;
    }
    const res = await handleRoutes(req);
    const response = new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS.headers,
      },
    });
    return response;
  },
});

let poolConfigAccount: PoolConfig;
try {
  poolConfigAccount = await PoolConfig.fetch(sdk, poolConfigAddress);
} catch (e) {
  console.log("error");
}

console.log("Server running on port" + " " + server.port);

console.log(
  "Server Time:" + new Date().toLocaleTimeString("en-US", { timeZone: "UTC" })
);

const calcLeaderBoardJob = cron.schedule("*/10 * * * *", async () => {
  await execCalculateLeaderBoardJob(poolId);
});

const activatePoolConfigAndDepositsJob = cron.schedule(
  "0 1 * * *",
  async () => {
    console.log("activate pool config and deposits  at 01:00 UTC.");
    poolId = await updateExistingPoolId();
    if (!poolConfigAccount) return;
    try {
      poolConfigAccount = await poolConfigAccount.activatePool();
      poolConfigAccount = await poolConfigAccount.activateDeposits();
      calcLeaderBoardJob.start();
    } catch (e) {
      console.log("error1", e);
    }
  }
);

const pauseDepositsJob = cron.schedule("0 22 * * *", async () => {
  console.log("depoists paused at 22:00 UTC.");
  if (!poolConfigAccount) return;
  try {
    poolConfigAccount = await poolConfigAccount.pauseDeposit();
  } catch (e) {
    console.log("error2", e);
  }
});

const endPoolConfigJob = cron.schedule("0 23 * * *", async () => {
  calcLeaderBoardJob.stop();
  console.log(" inactivate pool config Job executed at 23:00 UTC.");
  if (!poolConfigAccount) return;
  try {
    poolConfigAccount = await poolConfigAccount.pausePool();
  } catch (e) {
    console.log("error3", e);
  }
});

const transferPoolWinnersJob = cron.schedule("10 23 * * *", async () => {
  const winner = await getWinner();
  if (!winner) return;
  console.log("Winner", winner);
  try {
    poolConfigAccount = await poolConfigAccount.transferPoolWin(winner);
  } catch (e) {
    console.log("error4", e);
  }
});

const handleRoutes = async (req: Request): Promise<Response> => {
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
      const reqJson1 = await req.json();
      if (!reqJson1) {
        return Response.json({ error: "No body" }, { status: 400 });
      }
      if (!reqJson1?.position || typeof reqJson1?.position !== "object") {
        return Response.json(
          { error: "No position object passed" },
          { status: 400 }
        );
      }
      return await handlePostCreatePosition(reqJson1?.position, poolId);

    case "/poolGetPositions":
      pubkey = queryParams?.pubkey;
      if (!pubkey) {
        return Response.json({ error: "No pubkey" }, { status: 400 });
      }
      return await handleGetPositions(String(pubkey), poolId);

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

    case "/poolCreatePositions":
      const reqJson = await req.json();
      if (!reqJson) {
        return Response.json({ error: "No body" }, { status: 400 });
      }
      pubkey = reqJson?.pubkey;
      if (!pubkey) {
        return Response.json({ error: "No pubkey" }, { status: 400 });
      }
      if (!reqJson?.positions || reqJson?.positions?.length === 0) {
        return Response.json({ error: "No positions passed" }, { status: 400 });
      }
      return await handlePostCreatePositions(reqJson.positions, poolId, pubkey);

    case "/leaderBoard":
      return await handleGetLeaderboard(poolId);

    case "/getPositionsStat":
      pubkey = queryParams?.pubkey;
      if (!pubkey) {
        return Response.json({ error: "No pubkey" }, { status: 400 });
      }
      return await handleGetPositionsStat(String(pubkey), poolId);

    case "/changePoolIdByAuthority":
      const reqJson2 = await req.json();
      if (!reqJson2) {
        return Response.json({ error: "No body" }, { status: 400 });
      }
      const sentAuthHash = reqJson2?.authHash;
      if (!sentAuthHash) {
        return Response.json({ error: "No authHash passed" }, { status: 400 });
      }
      if (sentAuthHash !== authHash) {
        return Response.json(
          { error: "Authentication failed" },
          { status: 400 }
        );
      }
      poolId = await updateExistingPoolId();

      return Response.json({ poolId }, { status: 200 });
  }
};
