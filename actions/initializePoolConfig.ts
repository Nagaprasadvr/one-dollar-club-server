import type { Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { SDK } from "../sdk/sdk";
import { PoolConfig } from "../sdk/poolConfig";
import * as anchor from "@coral-xyz/anchor";
import {
  BONK_MAINNET_MINT,
  HELIUS_MAINNET_RPC_ENDPOINT,
} from "../utils/constants";
import os from "os";
import fs from "fs";
import { getWalletFromKeyPair } from "../utils/helpers";

export const initializePoolConfig = async () => {
  const homeDir = os.homedir();
  const poolActiveMint = new PublicKey(BONK_MAINNET_MINT);
  const squadsPubkey = new PublicKey(
    "AsM97N16ejpKcVJTwEWtnLsDMz7jFPGr6SU1vzJD9xZt"
  );
  const poolDepositPerUser = 40_000;
  const poolRoundWinAllocation = 0.5;
  const poolConfig = Keypair.generate();
  const SERVER_KEYAPIR_PATH = `${homeDir}/.config/solana/id.json`;
  const keypairFile = fs.readFileSync(SERVER_KEYAPIR_PATH, "utf-8");
  const keypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(keypairFile))
  );
  const wallet = getWalletFromKeyPair(keypair);
  const sdk = new SDK(
    new anchor.web3.Connection(
      "https://rpc.hellomoon.io/f1c9764a-5e99-4e75-ada7-fee44b2d5571"
    ),
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
