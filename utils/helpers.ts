import { Wallet } from "@coral-xyz/anchor";

import type { Keypair } from "@solana/web3.js";
import type { BirdeyeTokenPriceData } from "./types";
import axios from "axios";
import db from "../db/connection";
import {
  type PoolConfigId,
  type Deposits,
  type LeaderBoard,
  type Position,
} from "../models/models";
import { PROJECTS_TO_PLAY } from "./constants";

export const getRouteEndpoint = (url: string): string => {
  let endpoint = url.split("/").pop();
  endpoint = endpoint ? endpoint.split("?")[0] : "";

  if (endpoint) {
    return "/" + endpoint;
  }
  return "/";
};

export const getQueryParams = (url: string): Record<string, string> => {
  const query = url.split("?")[1];
  if (!query) {
    return {};
  }
  const params = query.split("&");
  const queryParams: Record<string, string> = {};
  params.forEach((param) => {
    const [key, value] = param.split("=");
    queryParams[key] = value;
  });
  return queryParams;
};

export const getWalletFromKeyPair = (keypair: Keypair): Wallet => {
  return new Wallet(keypair);
};

export const generatePoolId = (): string => {
  let poolId = "";
  for (let i = 0; i < 20; i++) {
    poolId += String.fromCharCode(
      97 + Math.floor(Math.random() * 10 + Math.random() * 10)
    );
  }
  return poolId;
};

export const fetchBirdeyeTokenPrices = async (tokenAddressArray: string[]) => {
  const BIRDEYE_BASE_URL = "https://public-api.birdeye.so/defi";
  const birdeyeApiKey = process.env.BIRDEYE_API_KEY;
  const headers = {
    "X-API-KEY": birdeyeApiKey,
  };

  if (!tokenAddressArray || tokenAddressArray?.length === 0) {
    return [];
  }
  try {
    const tokenNamesJoined = tokenAddressArray.join("%2C");
    const response = await axios.get(
      `${BIRDEYE_BASE_URL}/multi_price?list_address=${tokenNamesJoined}`,
      {
        headers: headers,
      }
    );
    const tokenDataObject = response.data.data;
    const tokensPrices: BirdeyeTokenPriceData[] = Object.keys(
      tokenDataObject
    ).map((tokenAddress) => {
      const tokenData = tokenDataObject[tokenAddress];
      return {
        address: tokenAddress,
        value: tokenData.value,
        updateUnixTime: tokenData.updateUnixTime,
        updateHumanTime: tokenData.updateHumanTime,
        priceChange24h: tokenData.priceChange24h,
      };
    });
    return tokensPrices;
  } catch (e) {
    return [];
  }
};

type PositionResult = {
  entryPrice: number;
  leverage: number;
  currentPrice: number;
  liquidationPrice: number;
  pointsAllocated: number;
  positionType: string;
};

export const safeDivide = (a: number, b: number) => {
  if (b === 0) return 0;
  return a / b;
};

export const calculateResult = (result: PositionResult) => {
  const { entryPrice, leverage, currentPrice, pointsAllocated, positionType } =
    result;

  const pointsPerEntryPrice = safeDivide(pointsAllocated, entryPrice);

  const mulCurrentPrice = pointsPerEntryPrice * currentPrice;

  let resultingDiff = 0;
  switch (positionType) {
    case "long":
      resultingDiff = mulCurrentPrice - pointsAllocated;
      break;
    case "short":
      resultingDiff = pointsAllocated - mulCurrentPrice;
      break;
  }

  const withLeverage = resultingDiff * leverage;

  const finalResult = withLeverage + pointsAllocated;

  if (finalResult < 0) {
    return 0;
  }
  return finalResult;
};

export const getAllDeposits = async (poolId: string) => {
  try {
    const depositsCollection = await db.collection<Deposits>("deposits");
    const deposits = await depositsCollection
      .find({
        poolId,
      })
      .toArray();
    if (deposits.length === 0) {
      return [];
    }
    return deposits;
  } catch (e) {
    return [];
  }
};

export const getAllPositions = async (poolId: string) => {
  try {
    const positionsCollection = await db.collection<Position>("position");
    const positions = await positionsCollection
      .find({
        poolId,
      })
      .toArray();
    if (positions.length === 0) {
      return [];
    }
    return positions;
  } catch (e) {
    return [];
  }
};

export const execCalculateLeaderBoardJob = async (poolId: string) => {
  try {
    console.log("Calculating leader board");
    const tokenAddressArray = PROJECTS_TO_PLAY.map((project) => project.mint);
    const tokenPrices = await fetchBirdeyeTokenPrices(tokenAddressArray);
    if (tokenPrices.length === 0) {
      return;
    }

    const deposits = await getAllDeposits(poolId);
    const positions = await getAllPositions(poolId);

    if (deposits.length === 0 || positions.length === 0) {
      return;
    }

    const players = deposits.map((deposit) => deposit.pubkey);

    const leaderBoardData: LeaderBoard[] = [];
    const leaderBoardCollection = await db.collection<LeaderBoard>(
      "leaderBoard"
    );

    const leaderBoardDbData = await leaderBoardCollection
      .find({
        poolId,
      })
      .toArray();

    console.log("players", players);
    for (const player of players) {
      const playerPositions = positions.filter(
        (position) => position.pubkey === player
      );
      if (playerPositions.length === 0) return;
      const totalPointsAllocated = playerPositions.reduce(
        (acc, position) => acc + position.pointsAllocated,
        0
      );
      const resultingPositions: {
        tokenName: string;
        resultingPoints: number;
      }[] = [];
      let resultingPoints = 0;
      for (const position of playerPositions) {
        const tokenPrice = tokenPrices.find(
          (token) => token.address === position.tokenMint
        );
        if (!tokenPrice) {
          continue;
        }
        const cal = calculateResult({
          entryPrice: position.entryPrice,
          leverage: position.leverage,
          currentPrice: tokenPrice.value,
          liquidationPrice: position.liquidationPrice,
          pointsAllocated: position.pointsAllocated,
          positionType: position.positionType,
        });
        resultingPositions.push({
          tokenName: position.tokenName,
          resultingPoints: cal,
        });

        resultingPoints += cal;
      }
      leaderBoardData.push({
        pubkey: player,
        pointsAllocated: totalPointsAllocated,
        poolId: poolId,
        finalPoints: resultingPoints,
        top3Positions: resultingPositions
          .sort((a, b) => b.resultingPoints - a.resultingPoints)
          .slice(0, 3)
          .map((position) => position.tokenName)
          .join(","),
      });
    }
    const top10LeaderBoard = leaderBoardData
      .sort((a, b) => b.finalPoints - a.finalPoints)
      .slice(0, 10);

    console.log("Top 10 Leader Board", top10LeaderBoard);
    if (leaderBoardDbData.length === 0) {
      await leaderBoardCollection.insertMany(top10LeaderBoard);
    } else {
      await leaderBoardCollection.deleteMany({});
      await leaderBoardCollection.insertMany(top10LeaderBoard);
    }
  } catch (e) {
    console.log(e);
  }
};

export const fetchAndSetPoolId = async () => {
  const poolConfigIdCollection = await db.collection<PoolConfigId>(
    "poolConfigId"
  );
  const poolConfigIdData = await poolConfigIdCollection.findOne({});
  if (!poolConfigIdData) {
    const poolId = generatePoolId();
    await poolConfigIdCollection.insertOne({
      poolId,
      lastUpdatedTs: Math.ceil(Date.now() / 1000),
    });
    return poolId;
  }
  return poolConfigIdData.poolId;
};

export const updateExistingPoolId = async () => {
  const poolConfigIdCollection = await db.collection<PoolConfigId>(
    "poolConfigId"
  );
  const poolConfigIdData = await poolConfigIdCollection.findOne({});
  if (!poolConfigIdData) {
    const poolId = await fetchAndSetPoolId();
    return poolId;
  }
  const oldPoolId = poolConfigIdData.poolId;
  const newPoolId = generatePoolId();
  await poolConfigIdCollection.updateOne(
    { poolId: oldPoolId },
    {
      $set: {
        poolId: newPoolId,
        lastUpdatedTs: Math.ceil(Date.now() / 1000),
      },
    }
  );
  return newPoolId;
};
