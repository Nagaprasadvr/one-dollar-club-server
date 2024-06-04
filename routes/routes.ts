import { PublicKey } from "@solana/web3.js";
import db from "../db/connection";
import {
  type Position,
  type Points,
  type Deposits,
  type LeaderBoard,
} from "../models/models";
import type { PoolConfig } from "../sdk/poolConfig";
import { MAX_POINTS, PROJECTS_TO_PLAY } from "../utils/constants";
import { fetchBirdeyeTokenPrices } from "../utils/helpers";

export const handlePoolConfigRoute = (poolConfig: PoolConfig): Response => {
  if (!poolConfig)
    return Response.json(
      {
        message: "Pool config not found",
      },
      {
        status: 404,
      }
    );

  const data = {
    poolState: poolConfig.poolState,
    poolAddress: poolConfig.poolAddress,
    poolAuthority: poolConfig.poolAuthority,
    poolActiveMint: poolConfig.poolActiveMint,
    poolDepositPerUser: poolConfig.poolDepositPerUser,
    poolRoundWinAllocation: poolConfig.poolRoundWinAllocation,
    squadsAuthorityPubkey: poolConfig.squadsAuthorityPubkey,
    poolBalance: poolConfig.poolBalance,
  };
  return Response.json({ data }, { status: 200 });
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
    const entryExists = await depositsCollection.findOne({
      pubkey,
      poolId,
    });
    if (!entryExists) {
      return Response.json(
        { error: "No deposit found , cant create position if not deposited" },
        { status: 404 }
      );
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
    if (!deposits) {
      return Response.json({ data: false }, { status: 200 });
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

export const hanldeGetBirdeyeTokenPrices = async () => {
  try {
    const tokenAddressArray = PROJECTS_TO_PLAY.map((project) => project.mint);
    const tokenPrices = await fetchBirdeyeTokenPrices(tokenAddressArray);
    return Response.json({ data: tokenPrices }, { status: 200 });
  } catch (e) {
    return Response.json({ error: "Error in getting prices" }, { status: 500 });
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
