import type { PoolConfig } from "../sdk/poolConfig";
import type { PoolState } from "../sdk/types";

export type Deposits = {
  pubkey: string;
  timeStamp: number;
  poolId: string;
};

export type Points = {
  pubkey: string;
  pointsRemaining: number;
  poolId: string;
};

export type Position = {
  pubkey: string;
  timeStamp: number;
  tokenName: string;
  tokenMint: string;
  entryPrice: number;
  leverage: number;
  pointsAllocated: number;
  poolId: string;
  positionType: "long" | "short";
  liquidationPrice: number;
};

export type LeaderBoard = {
  pubkey: string;
  pointsAllocated: number;
  poolId: string;
  finalPoints: number;
  top3Positions: string;
};

export type PoolConfigId = {
  poolId: string;
  gamesPlayed: number;
  lastUpdatedTs: number;
};

export type LeaderBoardLastUpdated = {
  poolId: string;
  lastUpdatedTs: number;
};

export type PoolConfigAccount = {
  poolState: PoolState;
  poolAddress: string;
  poolAuthority: string;
  poolActiveMint: string;
  poolDepositPerUser: number;
  poolRoundWinAllocation: number;
  squadsAuthorityPubkey: string;
  poolBalance: number;
  poolDepositsPaused: boolean;
};

export type LeaderBoardHistory = {
  pubkey: string;
  pointsAllocated: number;
  poolId: string;
  finalPoints: number;
  top3Positions: string;
  rank: number;
  date: string;
};

export type NFTCollection = {
  name: string;
  collectionAddress: string;
};

export type NFTOwnership = {
  owner: string;
  nftCollections: NFTCollection[];
};

export type BirdeyeTokenPriceData = {
  address: string;
  value: number;
  updateUnixTime: number;
  updateHumanTime: string;
};

export type BirdeyeTokenPriceLastUpdated = {
  lastUpdatedTs: number;
};
