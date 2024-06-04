import type { PublicKey } from "@solana/web3.js";
import type { PoolState } from "./types";
import type { RawPoolConfig, SDK } from "./sdk";
import * as solana from "@solana/web3.js";

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

  constructor(_sdk: SDK, data: RawPoolConfig) {
    this.sdk = _sdk;
    this.poolAddress = data.poolAddress;
    this.poolAuthority = data.poolAuthority;
    this.poolActiveMint = data.poolActiveMint;
    this.poolDepositPerUser = data.poolDepositPerUser;
    this.poolRoundWinAllocation = data.poolRoundWinAllocation;
    this.squadsAuthorityPubkey = data.squadsAuthorityPubkey;
    this.poolBalance = data.poolBalance;
    this.poolState = data.poolState.active ? "Active" : "Inactive";
  }

  async reload(): Promise<PoolConfig> {
    return PoolConfig.fetch(this.sdk, this.poolAddress);
  }

  static async fetch(sdk: SDK, address: PublicKey): Promise<PoolConfig> {
    const poolConfigAcc = await sdk.program.account.poolConfig.fetch(address);
    return new PoolConfig(sdk, poolConfigAcc);
  }

  async pausePool(): Promise<PoolConfig> {
    await this.sdk.program.methods
      .pausePoolState()
      .accountsStrict({
        poolAuthority: this.poolAuthority,
        poolConfig: this.poolAddress,
      })
      .rpc();

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
    await sdk.program.methods
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
      .rpc();
  }

  async activatePool(): Promise<PoolConfig> {
    await this.sdk.program.methods
      .activatePoolState()
      .accountsStrict({
        poolAuthority: this.poolAuthority,
        poolConfig: this.poolAddress,
      })
      .rpc();

    return this.reload();
  }

  async changeMint(newMint: PublicKey): Promise<PoolConfig> {
    await this.sdk.program.methods
      .changeMint()
      .accountsStrict({
        poolAuthority: this.poolAuthority,
        poolConfig: this.poolAddress,
        mint: newMint,
      })
      .rpc();

    return this.reload();
  }
}
