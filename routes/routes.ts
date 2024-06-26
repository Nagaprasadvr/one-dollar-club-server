import { PublicKey } from "@solana/web3.js";
import db from "../db/connection";
import {
  type Position,
  type Points,
  type Deposits,
  type LeaderBoard,
  type PoolConfigAccount,
  type LeaderBoardHistory,
  type PoolConfigId,
  type LeaderBoardLastUpdated,
  type BirdeyeTokenPriceData,
  type BirdeyeTokenPriceLastUpdated,
  type NFTOwnership,
} from "../models/models";

import {
  MAX_POINTS,
  NFTGatedTokens,
  PROJECTS_TO_PLAY,
} from "../utils/constants";
import {
  calculateResult,
  fetchBirdeyeTokenPriceFallback,
  insertToNFTOwnership,
  searchAndVerifyNFTAsset,
} from "../utils/helpers";

export const handlePoolConfigRoute = async (): Promise<Response> => {
  const poolConfigCollection = await db.collection<PoolConfigAccount>(
    "poolConfigAccount"
  );
  const poolConfig = await poolConfigCollection.findOne();
  if (!poolConfig)
    return Response.json(
      {
        message: "Pool config not found",
      },
      {
        status: 404,
      }
    );

  return Response.json({ poolConfig }, { status: 200 });
};

export const handlePostPoolDeposit = async (pubkey: string, poolId: string) => {
  try {
    const validPubkey = PublicKey.isOnCurve(pubkey);
    if (!validPubkey) {
      return Response.json({ error: "Invalid pubkey" }, { status: 400 });
    }

    const depositsCollection = await db.collection<Deposits>("deposits");
    const currentTsInSeconds = Math.floor(Date.now() / 1000);
    const entryAlreadyExists = await depositsCollection.findOne({
      pubkey,
      poolId,
    });
    if (entryAlreadyExists) {
      return Response.json({ error: "Entry already Exists" }, { status: 400 });
    }
    await depositsCollection.insertOne({
      pubkey,
      timeStamp: currentTsInSeconds,
      poolId,
    });
    const pointsCollection = await db.collection<Points>("points");
    await pointsCollection.insertOne({
      pubkey,
      pointsRemaining: MAX_POINTS,
      poolId,
    });
    return Response.json(
      {
        message: `Added pubkey entry sucessfully and 100 points have been allocated to:${pubkey}`,
      },
      { status: 200 }
    );
  } catch (e) {
    console.log("error", e);
    return Response.json({ error: "Error in depositing" }, { status: 500 });
  }
};

export const handleGetPoolDeposits = async (pubkey: string) => {
  try {
    const depositsCollection = await db.collection<Deposits>("deposits");
    const deposits = await depositsCollection
      .find({
        pubkey,
      })
      .toArray();

    if (deposits.length === 0) {
      return Response.json({ error: "No deposit found" }, { status: 404 });
    }
    return Response.json({ data: deposits }, { status: 200 });
  } catch (e) {
    return Response.json(
      { error: "Error in getting deposit" },
      { status: 500 }
    );
  }
};

type PositionWithoutPoolId = {
  pubkey: string;
  tokenName: string;
  tokenMint: string;
  entryPrice: number;
  leverage: number;
  pointsAllocated: number;
  positionType: "long" | "short";
  liquidationPrice: number;
};

export const handlePostCreatePosition = async (
  poistionWithoutPoolId: PositionWithoutPoolId,
  poolId: string
) => {
  const {
    pubkey,
    tokenName,
    tokenMint,
    entryPrice,
    leverage,
    pointsAllocated,
    positionType,
    liquidationPrice,
  } = poistionWithoutPoolId;

  if (
    !pubkey ||
    !tokenName ||
    !tokenMint ||
    !entryPrice ||
    !leverage ||
    !pointsAllocated ||
    !positionType ||
    !liquidationPrice
  ) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  if (pointsAllocated <= 0) {
    return Response.json(
      { error: "Points allocated should be greater than 0" },
      { status: 400 }
    );
  }

  if (leverage <= 0) {
    return Response.json(
      { error: "Leverage should be greater than 0" },
      { status: 400 }
    );
  }

  try {
    const validPubkey = PublicKey.isOnCurve(pubkey);
    if (!validPubkey) {
      return Response.json({ error: "Invalid pubkey" }, { status: 400 });
    }

    const depositsCollection = await db.collection<Deposits>("deposits");
    const deposits = await depositsCollection.findOne({
      pubkey,
      poolId,
    });
    const nftOwnershipCollection = await db.collection<NFTOwnership>(
      "nftOwnership"
    );
    const nftOwnership = await nftOwnershipCollection.findOne({
      owner: pubkey,
    });
    if (!deposits && !nftOwnership) {
      return Response.json({ error: "not allowed to play" }, { status: 200 });
    }

    const pointsCollection = await db.collection<Points>("points");
    const points = await pointsCollection.findOne({ pubkey, poolId });
    if (!points) {
      return Response.json({ error: "No points found" }, { status: 404 });
    }

    if (points.pointsRemaining < pointsAllocated) {
      return Response.json(
        {
          error: "Insufficient points",
        },
        { status: 400 }
      );
    }

    const positionCollection = await db.collection<Position>("position");
    const positionExists = await positionCollection.findOne({
      tokenName,
      tokenMint,
      pubkey,
      poolId,
    });
    if (positionExists) {
      return Response.json(
        {
          error: "Position already exists",
        },
        { status: 400 }
      );
    }
    const timeStamp = Math.floor(Date.now() / 1000);

    const poistion = {
      pubkey,
      timeStamp,
      tokenName,
      tokenMint,
      entryPrice,
      leverage,
      pointsAllocated,
      poolId,
      positionType,
      liquidationPrice,
    };
    await positionCollection.insertOne(poistion);
    await pointsCollection.updateOne(
      { pubkey, poolId },
      {
        $set: {
          pointsRemaining: points.pointsRemaining - pointsAllocated,
        },
      }
    );

    return Response.json(
      {
        message: `Position created successfully for ${pubkey}`,
      },
      { status: 200 }
    );
  } catch (e) {
    console.log("error", e);
    return Response.json(
      { error: "Error in creating position" },
      { status: 500 }
    );
  }
};

export const handlePostCreatePositions = async (
  positions: Array<PositionWithoutPoolId>,
  poolId: string,
  pubkey: string
) => {
  try {
    const validPositions: Position[] = [];
    const totalPointsAllocated: number[] = [];
    const depositsCollection = await db.collection<Deposits>("deposits");
    const entryExists = await depositsCollection.findOne({
      pubkey,
      poolId,
    });
    if (!entryExists) {
      return Response.json(
        {
          error: "No deposit found , cant create position if not deposited",
        },
        { status: 404 }
      );
    }
    const pointsCollection = await db.collection<Points>("points");
    const points = await pointsCollection.findOne({
      pubkey,
      poolId,
    });
    if (!points) {
      return Response.json({ message: "No points found" }, { status: 200 });
    }
    if (!positions || positions.length === 0) {
      return Response.json({ message: "No positions passed" }, { status: 200 });
    }

    for (const position of positions) {
      const {
        pubkey,
        tokenName,
        tokenMint,
        entryPrice,
        leverage,
        pointsAllocated,
        positionType,
        liquidationPrice,
      } = position;

      if (
        !pubkey ||
        !tokenName ||
        !tokenMint ||
        !entryPrice ||
        !leverage ||
        !pointsAllocated ||
        !positionType ||
        !liquidationPrice
      ) {
        return Response.json({ error: "Missing fields" }, { status: 400 });
      }

      if (pointsAllocated <= 0) {
        return Response.json(
          { error: "Points allocated should be greater than 0" },
          { status: 400 }
        );
      }

      if (leverage <= 0) {
        return Response.json(
          { error: "Leverage should be greater than 0" },
          { status: 400 }
        );
      }

      const validPubkey = PublicKey.isOnCurve(pubkey);
      if (!validPubkey) {
        return Response.json({ error: "Invalid pubkey" }, { status: 400 });
      }

      const pointsCollection = await db.collection<Points>("points");
      const points = await pointsCollection.findOne({ pubkey, poolId });
      if (!points) {
        return Response.json({ error: "No points found" }, { status: 404 });
      }

      if (points.pointsRemaining < pointsAllocated) {
        return Response.json(
          {
            error: "Insufficient points",
          },
          { status: 400 }
        );
      }

      const positionCollection = await db.collection<Position>("position");
      const positionExists = await positionCollection.findOne({
        tokenName,
        tokenMint,
        pubkey,
        poolId,
      });
      if (positionExists) {
        return Response.json(
          {
            error: "Position already exists",
          },
          { status: 400 }
        );
      }
      totalPointsAllocated.push(pointsAllocated);
      validPositions.push({
        pubkey,
        timeStamp: Math.floor(Date.now() / 1000),
        tokenName,
        tokenMint,
        entryPrice,
        leverage,
        pointsAllocated,
        poolId,
        positionType,
        liquidationPrice,
      });
    }

    const positionCollection = await db.collection<Position>("position");
    await positionCollection.insertMany(validPositions);
    const totalPoints = totalPointsAllocated.reduce((a, b) => a + b, 0);
    if (totalPoints > points.pointsRemaining) {
      return Response.json(
        {
          error: "Insufficient points",
        },
        { status: 400 }
      );
    }
    await pointsCollection.updateOne(
      { pubkey, poolId },
      {
        $set: {
          pointsRemaining: points.pointsRemaining - totalPoints,
        },
      }
    );
    return Response.json(
      {
        message: `Positions created successfully for ${pubkey}`,
      },
      { status: 200 }
    );
  } catch (e) {
    console.log("error", e);
    return Response.json(
      { error: "Error in creating position" },
      { status: 500 }
    );
  }
};

export const handleGetPositions = async (pubkey: string, poolId: string) => {
  try {
    const positionCollection = await db.collection<Position>("position");
    const positions = await positionCollection
      .find({ pubkey, poolId })
      .toArray();

    if (positions.length === 0) {
      return Response.json({ message: "No positions found" }, { status: 200 });
    }
    return Response.json({ data: positions }, { status: 200 });
  } catch (e) {
    return Response.json(
      { error: "Error in getting positions" },
      { status: 500 }
    );
  }
};

export const handleIsAllowedToPlay = async (pubkey: string, poolId: string) => {
  try {
    const depositsCollection = await db.collection<Deposits>("deposits");
    const deposits = await depositsCollection.findOne({
      pubkey,
      poolId,
    });
    const nftOwnershipCollection = await db.collection<NFTOwnership>(
      "nftOwnership"
    );
    const nftOwnership = await nftOwnershipCollection.findOne({
      owner: pubkey,
    });
    if (!deposits && !nftOwnership) {
      return Response.json({ error: "not allowed to play" }, { status: 200 });
    }
    if (deposits) {
      return Response.json(
        {
          data: {
            method: "deposit",
            verified: true,
          },
        },
        { status: 200 }
      );
    }
    if (nftOwnership) {
      return Response.json(
        {
          data: {
            method: "nft",
            verified: true,
            nftSymbol: nftOwnership.nftSymbol,
            name: nftOwnership.nftName,
          },
        },
        { status: 200 }
      );
    }
    return Response.json({ data: true }, { status: 200 });
  } catch (e) {
    return Response.json({ error: "Error in getting data" }, { status: 500 });
  }
};

export const handleGetPoints = async (pubkey: string, poolId: string) => {
  try {
    const pointsCollection = await db.collection<Points>("points");
    const points = await pointsCollection.findOne({ pubkey, poolId });
    if (!points) {
      return Response.json({ message: "No points found" }, { status: 200 });
    }
    return Response.json({ data: points.pointsRemaining }, { status: 200 });
  } catch (e) {
    return Response.json({ error: "Error in getting points" }, { status: 500 });
  }
};

export const handleGetLeaderboard = async (poolId: string) => {
  try {
    const leaderboardCollection = await db.collection<LeaderBoard>(
      "leaderBoard"
    );
    const leaderboard = await leaderboardCollection
      .find({ poolId })
      .sort({ points: -1 })
      .toArray();

    if (leaderboard.length === 0) {
      return Response.json({ message: "No data found" }, { status: 200 });
    }
    return Response.json({ data: leaderboard }, { status: 200 });
  } catch (e) {
    return Response.json(
      { error: "Error in getting leaderboard" },
      { status: 500 }
    );
  }
};

export const handleGetPositionsStat = async (
  pubkey: string,
  poolId: string
) => {
  try {
    const projectsToPlay = PROJECTS_TO_PLAY.map((project) => project.mint);
    const tokenPrice = await fetchBirdeyeTokenPriceFallback(projectsToPlay);

    const positionCollection = await db.collection<Position>("position");
    const positions = await positionCollection
      .find({ pubkey, poolId })
      .toArray();
    if (positions.length === 0) {
      return Response.json({ message: "No positions found" }, { status: 200 });
    }
    let resultingPoints = 0;
    const totalPointsAllocated = positions.reduce(
      (a, b) => a + b.pointsAllocated,
      0
    );
    const resultingPositions: {
      tokenName: string;
      resultingPoints: number;
    }[] = [];

    for (const position of positions) {
      const currentPrice = tokenPrice.find(
        (price) => price.address === position.tokenMint
      );
      if (!currentPrice) {
        return Response.json({ error: "No price found" }, { status: 404 });
      }
      const finalPoints = calculateResult({
        entryPrice: position.entryPrice,
        leverage: position.leverage,
        liquidationPrice: position.liquidationPrice,
        positionType: position.positionType,
        currentPrice: currentPrice.value,
        pointsAllocated: position.pointsAllocated,
      });
      resultingPositions.push({
        tokenName: position.tokenName,
        resultingPoints: finalPoints,
      });
      resultingPoints += finalPoints;
    }
    const data: LeaderBoard = {
      pubkey,
      pointsAllocated: totalPointsAllocated,
      poolId,
      finalPoints: resultingPoints,
      top3Positions: resultingPositions
        .sort((a, b) => b.resultingPoints - a.resultingPoints)
        .slice(0, 3)
        .map((position) => position.tokenName)
        .join(","),
    };

    return Response.json(
      {
        data,
      },
      { status: 200 }
    );
  } catch (e) {
    return Response.json(
      { error: "Error in getting positions" },
      { status: 500 }
    );
  }
};

export const handleGetLeaderBoardHistory = async (
  date?: string,
  poolId?: string
) => {
  try {
    const leaderBoardHistoryCollection =
      await db.collection<LeaderBoardHistory>("leaderBoardHistory");

    let query = {};
    if (date) {
      query = { date };
    }
    if (poolId) {
      query = { ...query, poolId };
    }
    const leaderBoardHistory = await leaderBoardHistoryCollection
      .find(query)
      .toArray();
    if (leaderBoardHistory.length === 0) {
      return Response.json({ message: "No data found" }, { status: 200 });
    }
    return Response.json({ data: leaderBoardHistory }, { status: 200 });
  } catch (e) {
    return Response.json(
      { error: "Error in getting leaderboard" },
      { status: 500 }
    );
  }
};

export const handleGetLeaderBoardLastUpdated = async (poolId: string) => {
  try {
    const leaderBoardLastUpdatedCollection =
      await db.collection<LeaderBoardLastUpdated>("leaderBoardLastUpdated");

    const leaderBoardLastUpdated =
      await leaderBoardLastUpdatedCollection.findOne({ poolId });
    if (!leaderBoardLastUpdated) {
      return Response.json({ message: "No data found" }, { status: 200 });
    }
    return Response.json({ data: leaderBoardLastUpdated }, { status: 200 });
  } catch (e) {
    return Response.json(
      { error: "Error in getting leaderboardLastUpdated" },
      { status: 500 }
    );
  }
};

export const handleGetTotalGamesPlayed = async (poolId: string) => {
  try {
    const poolConfigIdCollection = await db.collection<PoolConfigId>(
      "poolConfigId"
    );
    const poolConfigId = await poolConfigIdCollection.findOne({ poolId });
    if (!poolConfigId) {
      return Response.json({ message: "No data found" }, { status: 200 });
    }
    return Response.json({ data: poolConfigId.gamesPlayed }, { status: 200 });
  } catch (e) {
    return Response.json(
      { error: "Error in getting total games played" },
      { status: 500 }
    );
  }
};

export const hanldeGetBirdeyeTokenPrices = async () => {
  try {
    const birdeyeTokenPriceCollection =
      await db.collection<BirdeyeTokenPriceData>("birdeyeTokenPrice");

    const tokenPrices =
      (await birdeyeTokenPriceCollection.find().toArray()) ?? [];

    return Response.json({ data: tokenPrices }, { status: 200 });
  } catch (e) {
    return Response.json({ error: "Error in getting prices" }, { status: 500 });
  }
};

export const handleGetBirdeyeTokenPriceLastUpdated = async () => {
  try {
    const birdeyeTokenPriceLastUpdatedCollection =
      await db.collection<BirdeyeTokenPriceLastUpdated>(
        "birdeyeTokenPriceLastUpdated"
      );

    const tokenPriceLastUpdated =
      await birdeyeTokenPriceLastUpdatedCollection.findOne();
    if (!tokenPriceLastUpdated) {
      return Response.json({ message: "No data found" }, { status: 200 });
    }
    return Response.json({ data: tokenPriceLastUpdated }, { status: 200 });
  } catch (e) {
    return Response.json({ error: "Error in getting prices" }, { status: 500 });
  }
};

export const handleVerifyNFTOwnership = async (
  owner: string,
  collectionAddress: string
) => {
  try {
    const validOwnerPubkey = PublicKey.isOnCurve(owner);
    const validCollectionAddress = PublicKey.isOnCurve(collectionAddress);
    if (!validOwnerPubkey || !validCollectionAddress) {
      return Response.json({ error: "Invalid pubkey" }, { status: 400 });
    }
    const nftOwnershipCollection = await db.collection<NFTOwnership>(
      "nftOwnership"
    );
    const nftOwnership = await nftOwnershipCollection.findOne({
      owner,
      nftCollectionAddress: collectionAddress,
    });
    if (nftOwnership) {
      return Response.json({ error: "NFT already verified" }, { status: 200 });
    }
    const verifyResult = await searchAndVerifyNFTAsset(
      owner,
      collectionAddress
    );

    if (verifyResult) {
      const searchedNFT = NFTGatedTokens.find(
        (nft) => nft.collectionAddress === collectionAddress
      );

      if (!searchedNFT) {
        return Response.json(
          { error: "NFT could not be verified" },
          { status: 200 }
        );
      }
      await insertToNFTOwnership(
        owner,
        collectionAddress,
        searchedNFT.symbol,
        searchedNFT.name
      );
      return Response.json({ data: "NFT verified" }, { status: 200 });
    }
    return Response.json(
      { error: "NFT could not be verified" },
      { status: 200 }
    );
  } catch (e) {
    return Response.json(
      { error: "Error verifying nft ownership" },
      { status: 500 }
    );
  }
};

export const handleGetVerifyNFTOwnership = async (
  owner: string,
  collectionAddress: string
) => {
  try {
    const validOwnerPubkey = PublicKey.isOnCurve(owner);
    const validCollectionAddress = PublicKey.isOnCurve(collectionAddress);
    if (!validOwnerPubkey || !validCollectionAddress) {
      return Response.json({ error: "Invalid pubkey" }, { status: 400 });
    }

    const nftOwnershipCollection = await db.collection<NFTOwnership>(
      "nftOwnership"
    );
    const nftOwnership = await nftOwnershipCollection.findOne({
      owner,
      nftCollectionAddress: collectionAddress,
    });
    if (!nftOwnership) {
      return Response.json({ error: "NFT not verified" }, { status: 200 });
    }
    return Response.json({ data: nftOwnership }, { status: 200 });
  } catch (e) {
    return Response.json(
      { error: "Error getting verifying nft" },
      { status: 500 }
    );
  }
};
