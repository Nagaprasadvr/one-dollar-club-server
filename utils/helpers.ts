import { Wallet } from "@coral-xyz/anchor";

import type { Keypair } from "@solana/web3.js";
import type { EstimatedPriorityFee } from "./types";
import axios from "axios";
import db from "../db/connection";
import {
  type PoolConfigId,
  type Deposits,
  type LeaderBoard,
  type Position,
  type PoolConfigAccount,
  type LeaderBoardHistory,
  type LeaderBoardLastUpdated,
  type BirdeyeTokenPriceData,
  type BirdeyeTokenPriceLastUpdated,
} from "../models/models";
import {
  DEFAULT_COMPUTE_UNIT_PRICE_ML,
  DEFAULT_COMPUTE_UNITS_OFFSET,
  HELIUS_MAINNET_RPC_ENDPOINT,
  PROJECTS_TO_PLAY,
  TOKEN_GATED_NFTS_COLLECTION_PUBKEY_MAP,
} from "./constants";
import * as solana from "@solana/web3.js";
import type { SDK } from "../sdk/sdk";
import { PoolConfig } from "../sdk/poolConfig";

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
  const {
    entryPrice,
    leverage,
    currentPrice,
    pointsAllocated,
    positionType,
    liquidationPrice,
  } = result;

  switch (positionType) {
    case "long":
      if (currentPrice < liquidationPrice) {
        return 0;
      }
      break;
    case "short":
      if (currentPrice > liquidationPrice) {
        return 0;
      }
      break;
  }

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
    console.log("Calculating leader board at " + new Date().toUTCString());
    const leaderBoardLastUpdatedCollection =
      await db.collection<LeaderBoardLastUpdated>("leaderBoardLastUpdated");
    const leaderBoardLastUpdatedData =
      await leaderBoardLastUpdatedCollection.findOne({
        poolId,
      });

    if (!leaderBoardLastUpdatedData) {
      await leaderBoardLastUpdatedCollection.insertOne({
        poolId,
        lastUpdatedTs: Math.ceil(Date.now() / 1000),
      });
    } else {
      await leaderBoardLastUpdatedCollection.updateOne(
        {
          poolId,
        },
        {
          $set: {
            lastUpdatedTs: Math.ceil(Date.now() / 1000),
          },
        }
      );
    }
    const tokenAddressArray = PROJECTS_TO_PLAY.map((project) => project.mint);
    console.log("Fetching token prices before");
    const tokenPrices = await fetchBirdeyeTokenPriceFallback(tokenAddressArray);

    console.log("Token prices fetched", tokenPrices);
    if (tokenPrices.length === 0) {
      return;
    }
    await storeBirdEyeTokenPriceData(tokenPrices);
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

    for (const player of players) {
      const playerPositions = positions.filter(
        (position) => position.pubkey === player
      );
      if (playerPositions.length === 0) {
        continue;
      }
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
      gamesPlayed: 0,
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
        gamesPlayed: poolConfigIdData.gamesPlayed + 1,
      },
    }
  );
  return newPoolId;
};

export const getWinner = async () => {
  const leaderBoardCollection = await db.collection<LeaderBoard>("leaderBoard");
  const leaderBoardData = await leaderBoardCollection.find({}).toArray();
  if (leaderBoardData.length === 0) {
    return;
  }
  const winner = leaderBoardData[0];

  return winner.pubkey;
};

export const usePoolConfigChange = async (
  poolConfig: PoolConfig | null,
  sdk: SDK
) => {
  if (!sdk.connection || !poolConfig) return;
  sdk.connection.onAccountChange(poolConfig.poolAddress, async (account) => {
    const newPoolConfigAccount = await PoolConfig.fetch(
      sdk,
      poolConfig.poolAddress
    );
    const newPoolConfigDBAccount: PoolConfigAccount = {
      poolState: newPoolConfigAccount.poolState,
      poolAddress: newPoolConfigAccount.poolAddress.toBase58(),
      poolAuthority: newPoolConfigAccount.poolAuthority.toBase58(),
      poolActiveMint: newPoolConfigAccount.poolActiveMint.toBase58(),
      poolDepositPerUser: newPoolConfigAccount.poolDepositPerUser,
      poolRoundWinAllocation: newPoolConfigAccount.poolRoundWinAllocation,
      squadsAuthorityPubkey:
        newPoolConfigAccount.squadsAuthorityPubkey.toBase58(),
      poolBalance: newPoolConfigAccount.poolBalance,
      poolDepositsPaused: newPoolConfigAccount.poolDepositsPaused,
    };
    const poolConfigAccountCollection = await db.collection<PoolConfigAccount>(
      "poolConfigAccount"
    );
    const poolConfigAccountData = await poolConfigAccountCollection.findOne({});
    if (!poolConfigAccountData) {
      await poolConfigAccountCollection.insertOne(newPoolConfigDBAccount);
    } else {
      await poolConfigAccountCollection.updateOne(
        {},
        {
          $set: newPoolConfigDBAccount,
        }
      );
    }
  });
};

export const pushToLeaderBoardHistory = async () => {
  const leaderBoardHistoryCollection = await db.collection<LeaderBoardHistory>(
    "leaderBoardHistory"
  );
  const leaderBoardCollection = await db.collection<LeaderBoard>("leaderBoard");

  const leaderBoardData = await leaderBoardCollection.find({}).toArray();
  if (leaderBoardData.length === 0) {
    return;
  }
  const leaderBoardHistoryData: LeaderBoardHistory[] = leaderBoardData.map(
    (leaderBoard, index) => {
      return {
        pubkey: leaderBoard.pubkey,
        pointsAllocated: leaderBoard.pointsAllocated,
        poolId: leaderBoard.poolId,
        finalPoints: leaderBoard.finalPoints,
        top3Positions: leaderBoard.top3Positions,
        rank: index + 1,
        date: new Date().toISOString(),
      };
    }
  );

  await leaderBoardHistoryCollection.insertMany(leaderBoardHistoryData);
};

export const deleteLiveLeaderBoardData = async () => {
  try {
    const leaderBoardCollection = await db.collection<LeaderBoard>(
      "leaderBoard"
    );
    const leaderBoardData = await leaderBoardCollection.find({}).toArray();
    if (leaderBoardData.length === 0) {
      return;
    }
    await leaderBoardCollection.deleteMany({});
  } catch (e) {
    console.log(e);
  }
};

export const searchNFTAssets = async (owner: string) => {
  try {
    const response = await fetch(HELIUS_MAINNET_RPC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "tokenGate",
        method: "searchAssets",
        params: {
          ownerAddress: owner,
          grouping: [
            "collection",
            TOKEN_GATED_NFTS_COLLECTION_PUBKEY_MAP.map(
              (collection) => collection.collectionAddress
            ),
          ],
          page: 1, // Starts at 1
          limit: 1,
        },
      }),
    });
    const { result } = await response.json();
    return result;
  } catch (e) {
    console.log(e);
  }
};

export const getPoolConfigAccountFromCollection = async () => {
  const poolConfigAccountCollection = await db.collection<PoolConfigAccount>(
    "poolConfigAccount"
  );
  const poolConfigAccountData = await poolConfigAccountCollection.findOne({});
  if (!poolConfigAccountData) {
    return null;
  }
  return poolConfigAccountData;
};

export const insertToPoolConfigAccount = async (
  newPoolConfigAccount: PoolConfig
) => {
  const poolConfigAccountCollection = await db.collection<PoolConfigAccount>(
    "poolConfigAccount"
  );
  const poolConfigAccountData = await poolConfigAccountCollection.findOne({});
  if (poolConfigAccountData) return;
  const newPoolConfigDBAccount: PoolConfigAccount = {
    poolState: newPoolConfigAccount.poolState,
    poolAddress: newPoolConfigAccount.poolAddress.toBase58(),
    poolAuthority: newPoolConfigAccount.poolAuthority.toBase58(),
    poolActiveMint: newPoolConfigAccount.poolActiveMint.toBase58(),
    poolDepositPerUser: newPoolConfigAccount.poolDepositPerUser,
    poolRoundWinAllocation: newPoolConfigAccount.poolRoundWinAllocation,
    squadsAuthorityPubkey:
      newPoolConfigAccount.squadsAuthorityPubkey.toBase58(),
    poolBalance: newPoolConfigAccount.poolBalance,
    poolDepositsPaused: newPoolConfigAccount.poolDepositsPaused,
  };
  await poolConfigAccountCollection.insertOne(newPoolConfigDBAccount);
};

export const getEstimatedPriorityFee = async (
  sdk: SDK
): Promise<EstimatedPriorityFee> => {
  try {
    const recentPriorityFeeData =
      await sdk.connection.getRecentPrioritizationFees();

    if (recentPriorityFeeData.length === 0) {
      return null;
    }
    let avgPriorityFee = recentPriorityFeeData.reduce(
      (acc, { prioritizationFee }) => acc + prioritizationFee,
      0
    );
    avgPriorityFee /= recentPriorityFeeData.length;
    avgPriorityFee = Math.ceil(avgPriorityFee);

    return {
      microLamports: avgPriorityFee,
    };
  } catch (error) {
    return null;
  }
};

export const getComputeUnitsToBeConsumed = async (
  tx: solana.Transaction,
  connection: solana.Connection
) => {
  try {
    const latestBlockhash = await connection.getLatestBlockhash();
    const ixs = tx.instructions;
    if (!tx.feePayer) {
      return null;
    }
    const txMessage = new solana.TransactionMessage({
      payerKey: tx.feePayer,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: ixs,
    }).compileToV0Message();

    const versionedTx = new solana.VersionedTransaction(txMessage);
    const simulateTxResult = await connection.simulateTransaction(versionedTx, {
      sigVerify: false,
    });
    const unitsConsumed = simulateTxResult.value?.unitsConsumed;
    if (!unitsConsumed) {
      throw new Error("Failed to get units consumed");
    }
    return unitsConsumed + DEFAULT_COMPUTE_UNITS_OFFSET;
  } catch (error) {
    return null;
  }
};

export async function expirationRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  if (maxRetries === 0) return await fn();
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (!isTransactionExpiredBlockheightExceededError(error)) throw error;
      retryCount++;
      console.error(`Attempt ${retryCount + 1} tx expired. Retrying...`);
    }
  }
  throw new Error("Max Tx Expiration retries exceeded");
}

function isTransactionExpiredBlockheightExceededError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("TransactionExpiredBlockheightExceededError")
  );
}

export const sendAndConTxWithComputePriceAndRetry = async (
  ix: solana.TransactionInstruction,
  sdk: SDK
) => {
  const fn = async () => {
    const latestBlockHash = await sdk.connection.getLatestBlockhash();

    // let computeUnitsNeeded = await getComputeUnitsToBeConsumed(
    //   tx,
    //   sdk.connection
    // );
    // if (!computeUnitsNeeded) {
    //   computeUnitsNeeded = DEFAULT_COMPUTE_UNIT_LIMIT;
    // }

    // let estimatedPriorityFee = await getEstimatedPriorityFee(sdk);
    // if (!estimatedPriorityFee) {
    //   estimatedPriorityFee = {
    //     microLamports: DEFAULT_COMPUTE_UNIT_PRICE_ML,
    //   };
    // }

    const computeUnitPriceIx = solana.ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: DEFAULT_COMPUTE_UNIT_PRICE_ML,
    });
    // const computeUnitsLimitIx = solana.ComputeBudgetProgram.setComputeUnitLimit(
    //   {
    //     units: computeUnitsNeeded,
    //   }
    // );

    const txMessage = new solana.TransactionMessage({
      payerKey: sdk.wallet.payer.publicKey,
      recentBlockhash: latestBlockHash.blockhash,
      instructions: [computeUnitPriceIx, ix],
    }).compileToV0Message();

    const versionedTx = new solana.VersionedTransaction(txMessage);

    versionedTx.sign([sdk.wallet.payer]);

    const sig = await sdk.connection.sendTransaction(versionedTx);

    await sdk.connection.confirmTransaction({
      signature: sig,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      blockhash: latestBlockHash.blockhash,
    });

    return sig;
  };
  try {
    return await expirationRetry(fn, 2);
  } catch (e) {
    return null;
  }
};

export const fetchBirdeyeTokenPriceFallback = async (
  tokenAddressArray: string[]
) => {
  try {
    if (!tokenAddressArray || tokenAddressArray?.length === 0) {
      return [];
    }

    const tokenPrices = await Promise.all(
      tokenAddressArray.map(async (tokenAddress) => {
        return await fetchIndividualTokenPrice(tokenAddress);
      })
    );

    return tokenPrices;
  } catch (e) {
    console.error("token price err:=", e);
    return [];
  }
};

export const fetchIndividualTokenPrice = async (
  tokenAddress: string
): Promise<BirdeyeTokenPriceData> => {
  const BIRDEYE_BASE_URL = "https://public-api.birdeye.so/defi/price";
  const birdeyeApiKey = process.env.BIRDEYE_API_KEY;
  const headers = {
    "X-API-KEY": birdeyeApiKey,
  };

  try {
    const response = await axios.get(
      `${BIRDEYE_BASE_URL}?address=${tokenAddress}`,
      {
        headers: headers,
      }
    );
    const tokenData = response.data.data;
    return {
      address: tokenAddress,
      value: tokenData.value,
      updateUnixTime: tokenData.updateUnixTime,
      updateHumanTime: tokenData.updateHumanTime,
    };
  } catch (e) {
    console.error("token price err ind", e);
    return {
      address: tokenAddress,
      value: 0,
      updateUnixTime: 0,
      updateHumanTime: "",
    };
  }
};

export const storeBirdEyeTokenPriceData = async (
  tokenPrices: BirdeyeTokenPriceData[]
) => {
  const birdeyeTokenPriceCollection =
    await db.collection<BirdeyeTokenPriceData>("birdeyeTokenPrice");

  const birdeyeTokenPriceLastUpdated =
    await db.collection<BirdeyeTokenPriceLastUpdated>(
      "birdeyeTokenPriceLastUpdated"
    );

  const birdeyeTokenPriceLastUpdatedData =
    await birdeyeTokenPriceLastUpdated.findOne({});

  if (!birdeyeTokenPriceLastUpdatedData) {
    await birdeyeTokenPriceLastUpdated.insertOne({
      lastUpdatedTs: Math.ceil(Date.now() / 1000),
    });
  } else {
    await birdeyeTokenPriceLastUpdated.updateOne(
      {},
      {
        $set: {
          lastUpdatedTs: Math.ceil(Date.now() / 1000),
        },
      }
    );
  }
  const birdeyeTokenPriceData = await birdeyeTokenPriceCollection
    .find({})
    .toArray();

  if (birdeyeTokenPriceData.length === 0) {
    await birdeyeTokenPriceCollection.insertMany(tokenPrices);
  } else {
    await birdeyeTokenPriceCollection.deleteMany({});
    await birdeyeTokenPriceCollection.insertMany(tokenPrices);
  }
};
