import type { PublicKey } from "@solana/web3.js";
import type { PoolState } from "./types";
import type { RawPoolConfig, SDK } from "./sdk";
import * as solana from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import { sendAndConTxWithComputePriceAndRetry } from "../utils/helpers";

export class PoolConfig {
  private sdk: SDK;
  public poolState: PoolState;
  public poolAddress: PublicKey;
  public poolAuthority: PublicKey;
  public poolActiveMint: PublicKey;
  public poolDepositPerUser: number;
  public poolRoundWinAllocation: number;
  public squadsAuthorityPubkey: PublicKey;
  public poolBalance: number;
  public poolDepositsPaused: boolean;

  constructor(_sdk: SDK, data: RawPoolConfig) {
    this.sdk = _sdk;
    this.poolAddress = data.poolAddress;
    this.poolAuthority = data.poolAuthority;
    this.poolActiveMint = data.poolActiveMint;
    this.poolDepositPerUser = Number(data.poolDepositPerUser);
    this.poolRoundWinAllocation = data.poolRoundWinAllocation;
    this.squadsAuthorityPubkey = data.squadsAuthorityPubkey;
    this.poolBalance = data.poolBalance;
    this.poolState = data.poolState.active ? "Active" : "Inactive";
    this.poolDepositsPaused = data.poolDepositsPaused;
  }

  async reload(): Promise<PoolConfig> {
    return PoolConfig.fetch(this.sdk, this.poolAddress);
  }

  static async fetch(sdk: SDK, address: PublicKey): Promise<PoolConfig> {
    const poolConfigAcc = await sdk.program.account.poolConfig.fetch(address);
    return new PoolConfig(sdk, poolConfigAcc);
  }

  async pauseDeposit(): Promise<PoolConfig> {
    const ix = await this.sdk.program.methods
      .pauseDeposits()
      .accountsStrict({
        poolAuthority: this.poolAuthority,
        poolConfig: this.poolAddress,
      })
      .instruction();
    const sig = await sendAndConTxWithComputePriceAndRetry(ix, this.sdk);

    console.log("pauseDeposit sig", sig);
    return this.reload();
  }

  async pausePool(): Promise<PoolConfig> {
    const ix = await this.sdk.program.methods
      .pausePoolState()
      .accountsStrict({
        poolAuthority: this.poolAuthority,
        poolConfig: this.poolAddress,
      })
      .instruction();
    const sig = await sendAndConTxWithComputePriceAndRetry(ix, this.sdk);
    console.log("pausePool sig", sig);
    return this.reload();
  }

  static async initializePoolConfig(
    sdk: SDK,
    squadsPubkey: PublicKey,
    poolDepositPerUser: number,
    poolRoundWinAllocation: number,
    poolAuthority: PublicKey,
    poolConfig: solana.Keypair,
    poolActiveMint: PublicKey
  ) {
    const ix = await sdk.program.methods
      .initializeConfig(
        poolDepositPerUser,
        poolRoundWinAllocation,
        squadsPubkey
      )
      .accountsStrict({
        poolAuthority,
        poolConfig: poolConfig.publicKey,
        activeMint: poolActiveMint,
        systemProgram: solana.SystemProgram.programId,
      })
      .signers([poolConfig])
      .instruction();

    const sig = await sendAndConTxWithComputePriceAndRetry(ix, sdk);
  }

  async activatePool(): Promise<PoolConfig> {
    const ix = await this.sdk.program.methods
      .activatePoolState()
      .accountsStrict({
        poolAuthority: this.poolAuthority,
        poolConfig: this.poolAddress,
      })
      .instruction();

    const sig = await sendAndConTxWithComputePriceAndRetry(ix, this.sdk);
    console.log("activatePool sig", sig);
    return this.reload();
  }

  async activateDeposits(): Promise<PoolConfig> {
    const ix = await this.sdk.program.methods
      .resumeDeposits()
      .accountsStrict({
        poolAuthority: this.poolAuthority,
        poolConfig: this.poolAddress,
      })
      .instruction();
    const sig = await sendAndConTxWithComputePriceAndRetry(ix, this.sdk);
    console.log("activateDeposits sig", sig);
    return this.reload();
  }

  async changeMint(newMint: PublicKey): Promise<PoolConfig> {
    const ix = await this.sdk.program.methods
      .changeMint()
      .accountsStrict({
        poolAuthority: this.poolAuthority,
        poolConfig: this.poolAddress,
        mint: newMint,
      })
      .instruction();

    const sig = await sendAndConTxWithComputePriceAndRetry(ix, this.sdk);

    console.log("changeMint sig", sig);
    return this.reload();
  }

  async transferPoolWin(winner: string): Promise<PoolConfig> {
    const winnerPubkey = new solana.PublicKey(winner);

    const winnerTokenAccount = spl.getAssociatedTokenAddressSync(
      this.poolActiveMint,
      winnerPubkey
    );

    const squadsTokenAccount = spl.getAssociatedTokenAddressSync(
      this.poolActiveMint,
      this.squadsAuthorityPubkey
    );

    const poolTokenAccount = spl.getAssociatedTokenAddressSync(
      this.poolActiveMint,
      this.poolAuthority
    );

    const ix = await this.sdk.program.methods
      .transferWinAllocation()
      .accountsStrict({
        poolAuthority: this.poolAuthority,
        poolConfig: this.poolAddress,
        winnerTokenAccount,
        winner: winnerPubkey,
        squadsAuthority: this.squadsAuthorityPubkey,
        squadsTokenAccount,
        poolTokenAccount: poolTokenAccount,
        mint: this.poolActiveMint,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        systemProgram: solana.SystemProgram.programId,
      })
      .instruction();

    const sig = await sendAndConTxWithComputePriceAndRetry(ix, this.sdk);

    return this.reload();
  }
}
