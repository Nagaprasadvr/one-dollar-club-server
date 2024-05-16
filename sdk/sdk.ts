import {
  AnchorProvider,
  Program,
  Wallet,
  type IdlAccounts,
} from "@coral-xyz/anchor";

import {
  type OneDollarClub as OneDollarClubTypes,
  IDL as OneDollarClubIdl,
} from "./one_dollar_club";
import { Connection, PublicKey, type ConfirmOptions } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "HaebyXgGqUgGLQkY93CTm8iEC6gBjH1NU3Zgr7EG4wNW"
);

export type RawPoolConfig = IdlAccounts<OneDollarClubTypes>["poolConfig"];

export class SDK {
  public program: Program<OneDollarClubTypes>;

  constructor(
    public connection: Connection,
    public wallet: Wallet,
    confirmOptions: ConfirmOptions
  ) {
    const provider = new AnchorProvider(connection, wallet, confirmOptions);
    this.program = new Program(OneDollarClubIdl, provider);
  }
}
