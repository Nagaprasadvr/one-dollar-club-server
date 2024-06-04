import type { Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { SDK } from "../sdk/sdk";
import { PoolConfig } from "../sdk/poolConfig";
import * as anchor from "@coral-xyz/anchor";
import { HELIUS_DEVNET_RPC_ENDPOINT } from "../utils/constants";
import os from "os";
import fs from "fs";
import { getWalletFromKeyPair } from "../utils/helpers";

export const initializePoolConfig = async () => {
  const homeDir = os.homedir();
  const poolActiveMint = new PublicKey(
    "31nhKDV3WudEC8Nfwa8sfPiGq9FEeXknSmDZTSKQiru1"
  );
  const squadsPubkey = new PublicKey(
    "CNiF4Y8VdsA7aMftkF6kumEBz67AsCAyvnZDr6zopYSC"
  );
  const poolDepositPerUser = 50_000;
  const poolRoundWinAllocation = 0.5;
  const poolConfig = Keypair.generate();
  const SERVER_KEYAPIR_PATH = `${homeDir}/.config/solana/id.json`;
  const keypairFile = fs.readFileSync(SERVER_KEYAPIR_PATH, "utf-8");
  const keypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(keypairFile))
  );
  const wallet = getWalletFromKeyPair(keypair);
  const sdk = new SDK(
    new anchor.web3.Connection(HELIUS_DEVNET_RPC_ENDPOINT),
    wallet,
    {}
  );
  try {
    console.log("Initializing pool config");
    const accountExists = await sdk.connection.getAccountInfo(
      poolConfig.publicKey
    );
    if (accountExists) {
      throw new Error("Pool config already exists");
    }
    await PoolConfig.initializePoolConfig(
      sdk,
      squadsPubkey,
      new anchor.BN(poolDepositPerUser),
      poolRoundWinAllocation,
      wallet.publicKey,
      poolConfig,
      poolActiveMint
    );
    console.log("Pool config initialized", poolConfig.publicKey.toBase58());
  } catch (e) {
    throw e;
  }
};

await initializePoolConfig();
