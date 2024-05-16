import type { Wallet } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import type { Keypair } from "@solana/web3.js";

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
  return new NodeWallet(keypair);
};

export const generatePoolId = (): string => {
  let poolId = "";
  for (let i = 0; i < 10; i++) {
    poolId += String.fromCharCode(
      97 + Math.floor(Math.random() * 10 + Math.random() * 10)
    );
  }
  return poolId;
};
