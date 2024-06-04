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
