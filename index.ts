import * as cron from "cron";
import type { RequestMethods, Urls } from "./utils/types";
import {
  deleteLiveLeaderBoardData,
  execCalculateLeaderBoardJob,
  fetchAndSetPoolId,
  getPoolConfigAccountFromCollection,
  getQueryParams,
  getRouteEndpoint,
  getWalletFromKeyPair,
  getWinner,
  insertToPoolConfigAccount,
  pushToLeaderBoardHistory,
  updateExistingPoolId,
  usePoolConfigChange,
} from "./utils/helpers";
import dotenv from "dotenv";
import fs from "fs";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { SDK } from "./sdk/sdk";
import {
  authHash,
  BONK_MAINNET_MINT,
  HELIUS_MAINNET_RPC_ENDPOINT,
  MAINNET_POOL_CONFIG_PUBKEY,
} from "./utils/constants";
import { PoolConfig } from "./sdk/poolConfig";
import os from "os";
import {
  handleGetLeaderboard,
  handleGetLeaderBoardHistory,
  handleGetLeaderBoardLastUpdated,
  handleGetPoints,
  handleGetPoolDeposits,
  handleGetPositions,
  handleGetPositionsStat,
  handleGetTotalGamesPlayed,
  handleIsAllowedToPlay,
  handlePoolConfigRoute,
  handlePostCreatePosition,
  handlePostCreatePositions,
  handlePostPoolDeposit,
  handleGetBirdeyeTokenPriceLastUpdated,
  hanldeGetBirdeyeTokenPrices,
  handleGetVerifyNFTOwnership,
  handleVerifyNFTOwnership,
  handleGetNFTPoints,
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
  "/getLeaderBoardHistory",
  "/getLeaderBoardLastUpdated",
  "/poolGamesPlayed",
  "/getBirdeyeTokenPrices",
  "/getBirdeyeTokenPriceLastUpdated",
  "/verifyNFT",
  "/getVerifiedNFT",
  "/getNFTPoints",
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

const connection = new Connection(HELIUS_MAINNET_RPC_ENDPOINT, "confirmed");

const sdk = new SDK(connection, wallet, {
  commitment: "confirmed",
});

const poolActiveMint = new PublicKey(BONK_MAINNET_MINT);

const poolConfigAddress = new PublicKey(MAINNET_POOL_CONFIG_PUBKEY);
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

let poolConfigAccount: PoolConfig | null = null;
try {
  poolConfigAccount = await PoolConfig.fetch(sdk, poolConfigAddress);
  const poolConfigAccountDb = await getPoolConfigAccountFromCollection();
  if (!poolConfigAccountDb && poolConfigAccount) {
    await insertToPoolConfigAccount(poolConfigAccount);
  }
} catch (e) {
  console.log("error");
}

usePoolConfigChange(poolConfigAccount, sdk);

console.log("Server running on port" + " " + server.port);

console.log("Server Time:" + new Date().toISOString());

const calcLeaderBoardJob = new cron.CronJob(
  "*/5 * * * *",
  async () => {
    await execCalculateLeaderBoardJob(poolId);
  },
  null,
  true,
  "UTC"
);

const pauseDepositsJob = new cron.CronJob(
  "0 22 * * *",
  async () => {
    console.log("depoists paused at 22:00 UTC.");
    if (!poolConfigAccount) return;
    try {
      poolConfigAccount = await poolConfigAccount.pauseDeposit();
    } catch (e) {
      console.log("error1", e);
    }
  },
  null,
  true,
  "UTC"
);

const endPoolConfigJob = new cron.CronJob(
  "0 23 * * *",
  async () => {
    console.log("inactivate pool config at 23:00 UTC.");
    calcLeaderBoardJob.stop();
    await pushToLeaderBoardHistory();
    if (!poolConfigAccount) return;
    try {
      poolConfigAccount = await poolConfigAccount.pausePool();
    } catch (e) {
      console.log("error2", e);
    }
  },
  null,
  true,
  "UTC"
);

const transferPoolWinnersJob = new cron.CronJob(
  "30 23 * * *",
  async () => {
    if (!poolConfigAccount) return;
    console.log("transfer pool winners at 23:30 UTC.");
    const winner = await getWinner();
    if (!winner) return;
    console.log("Winner", winner);
    try {
      poolConfigAccount = await poolConfigAccount.transferPoolWin(winner);
    } catch (e) {
      console.log("error3", e);
    }
  },
  null,
  true,
  "UTC"
);

const activatePoolConfigJob = new cron.CronJob(
  "0 0 * * *",
  async () => {
    console.log("activate poolConfig at 00:00 UTC.");
    poolId = await updateExistingPoolId();
    await deleteLiveLeaderBoardData();
    if (!poolConfigAccount) return;
    try {
      poolConfigAccount = await poolConfigAccount.activatePool();
    } catch (e) {
      console.log("error4", e);
    }
  },
  null,
  true,
  "UTC"
);

const activatePoolDepositsJob = new cron.CronJob(
  "0 1 * * *",
  async () => {
    console.log("activate pool deposits at 01:00 UTC.");

    if (!poolConfigAccount) return;
    try {
      poolConfigAccount = await poolConfigAccount.activateDeposits();
      calcLeaderBoardJob.start();
    } catch (e) {
      console.log("error5", e);
    }
  },
  null,
  true,
  "UTC"
);

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
      if (!poolConfigAccount)
        return Response.json(
          { error: "Pool config not found" },
          { status: 404 }
        );
      return handlePoolConfigRoute();

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

    case "/getLeaderBoardHistory":
      const passedPoolId = queryParams?.poolId;
      const date = queryParams?.date;

      return await handleGetLeaderBoardHistory(date, passedPoolId);

    case "/getLeaderBoardLastUpdated":
      let passedPoolId1 = queryParams?.poolId;
      if (!passedPoolId1) {
        passedPoolId1 = poolId;
      }
      return await handleGetLeaderBoardLastUpdated(passedPoolId1);

    case "/poolGamesPlayed":
      return await handleGetTotalGamesPlayed(poolId);

    case "/getBirdeyeTokenPrices":
      return await hanldeGetBirdeyeTokenPrices();

    case "/getBirdeyeTokenPriceLastUpdated":
      return await handleGetBirdeyeTokenPriceLastUpdated();

    case "/verifyNFT":
      const reqJson3 = await req.json();
      if (!reqJson3) {
        return Response.json({ error: "No body" }, { status: 400 });
      }
      const owner = reqJson3?.owner;
      const nftCollectionAddress1 = reqJson3?.nftCollectionAddress;

      if (!owner || !nftCollectionAddress1) {
        return Response.json(
          { error: "No owner or nftCollectionAddress" },
          { status: 400 }
        );
      }

      return await handleVerifyNFTOwnership(
        String(owner),
        String(nftCollectionAddress1),
        poolId
      );

    case "/getVerifiedNFT":
      const nftOwner = queryParams?.pubkey;
      if (!nftOwner) {
        return Response.json({ error: "No pubkey" }, { status: 400 });
      }
      const nftCollectionAddress2 = queryParams?.nftCollectionAddress;
      return await handleGetVerifyNFTOwnership(
        String(nftOwner),
        nftCollectionAddress2,
        poolId
      );

    case "/getNFTPoints":
      return await handleGetNFTPoints(poolId);
  }
};
