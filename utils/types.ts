export type Urls =
  | "/"
  | "/poolStatus"
  | "/poolConfig"
  | "/poolDeposit"
  | "/poolGetPositions"
  | "/poolCreatePosition"
  | "/poolServerId"
  | "/isAllowedToPlay"
  | "/poolPoints"
  | "/poolCreatePositions"
  | "/leaderBoard"
  | "/getPositionsStat"
  | "/changePoolIdByAuthority"
  | "/getLeaderBoardHistory"
  | "/getLeaderBoardLastUpdated"
  | "/poolGamesPlayed";

export type RequestMethods = "GET" | "POST" | "PUT" | "DELETE";
export interface BirdeyeTokenPriceData {
  address: string;
  value: number;
  updateUnixTime: number;
  updateHumanTime: string;
  priceChange24h: number;
}

export type EstimatedPriorityFee = {
  microLamports: number;
} | null;

export type Project = {
  name: string;
  mint: string;
  logoURI: string;
};
