import { PublicKey } from "@solana/web3.js";
import db from "../db/connection";
import { type Position, type Points, type Deposits } from "../models/models";
import type { PoolConfig } from "../sdk/poolConfig";
import { MAX_POINTS } from "../utils/constants";

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
    console.log("pubkey", pubkey);
    const entryExists = await depositsCollection.findOne({
      pubkey,
    });
    if (!entryExists) {
      return Response.json(
        { error: "No deposit found , cant create position if not deposited" },
        { status: 404 }
      );
    }

    const pointsCollection = await db.collection<Points>("points");
    const points = await pointsCollection.findOne({ pubkey });
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
      { pubkey },
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

export const handleGetPositions = async (pubkey: string) => {
  try {
    const positionCollection = await db.collection<Position>("position");
    const positions = await positionCollection.find({ pubkey }).toArray();

    if (positions.length === 0) {
      return Response.json({ error: "No positions found" }, { status: 404 });
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
      return Response.json({ error: "No points found" }, { status: 404 });
    }
    return Response.json({ data: points.pointsRemaining }, { status: 200 });
  } catch (e) {
    return Response.json({ error: "Error in getting points" }, { status: 500 });
  }
};
