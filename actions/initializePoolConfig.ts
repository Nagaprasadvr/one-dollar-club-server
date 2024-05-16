import type { Wallet } from "@coral-xyz/anchor";
import { Keypair, type PublicKey } from "@solana/web3.js";
import type { SDK } from "../sdk/sdk";
import { PoolConfig } from "../sdk/poolConfig";
import * as anchor from "@coral-xyz/anchor";

export const initializePoolConfig = async (
  sdk: SDK,
  wallet: Wallet,
  poolActiveMint: PublicKey,
  squadsPubkey: PublicKey,
  poolDepositPerUser: number,
  poolRoundWinAllocation: number,
  poolConfig: Keypair
) => {
  try {
    console.log("Initializing pool config");
    console.log("connection", sdk.connection);
    const programAd = await sdk.connection.getAccountInfo(
      sdk.program.programId
    );
    console.log("programId", programAd);
    const accountExists = await sdk.connection.getAccountInfo(
      poolConfig.publicKey
    );
    if (accountExists) {
      throw new Error("Pool config already exists");
    }
    const poolConfigAccount = await PoolConfig.initializePoolConfig(
      sdk,
      squadsPubkey,
      new anchor.BN(poolDepositPerUser),
      poolRoundWinAllocation,
      wallet.publicKey,
      poolConfig,
      poolActiveMint
    );
    return poolConfigAccount;
  } catch (e) {
    throw e;
  }
};
