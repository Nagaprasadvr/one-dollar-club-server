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
  | "/poolGamesPlayed"
  | "/getBirdeyeTokenPrices"
  | "/getBirdeyeTokenPriceLastUpdated"
  | "/verifyNFT"
  | "/getVerifiedNFT";

export type RequestMethods = "GET" | "POST" | "PUT" | "DELETE";

export type EstimatedPriorityFee = {
  microLamports: number;
} | null;

export type Project = {
  name: string;
  mint: string;
  logoURI: string;
};
