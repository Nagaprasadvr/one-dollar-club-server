/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/one_dollar_club.json`.
 */
export type OneDollarClub = {
  address: "HaebyXgGqUgGLQkY93CTm8iEC6gBjH1NU3Zgr7EG4wNW";
  metadata: {
    name: "oneDollarClub";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "activatePoolState";
      discriminator: [212, 138, 44, 120, 39, 137, 118, 145];
      accounts: [
        {
          name: "poolConfig";
          writable: true;
        },
        {
          name: "poolAuthority";
          signer: true;
        }
      ];
      args: [];
    },
    {
      name: "changeDepositPerUser";
      discriminator: [200, 104, 204, 238, 225, 33, 120, 96];
      accounts: [
        {
          name: "poolConfig";
          writable: true;
        },
        {
          name: "poolAuthority";
          signer: true;
        }
      ];
      args: [
        {
          name: "poolDepositPerUser";
          type: "u64";
        }
      ];
    },
    {
      name: "changeMint";
      discriminator: [118, 99, 211, 172, 170, 106, 17, 38];
      accounts: [
        {
          name: "poolConfig";
          writable: true;
        },
        {
          name: "poolAuthority";
          signer: true;
        },
        {
          name: "mint";
        }
      ];
      args: [];
    },
    {
      name: "deposit";
      discriminator: [242, 35, 198, 137, 82, 225, 242, 182];
      accounts: [
        {
          name: "poolConfig";
          writable: true;
        },
        {
          name: "depositor";
          signer: true;
        },
        {
          name: "depositorTokenAccount";
          writable: true;
        },
        {
          name: "mint";
        },
        {
          name: "poolTokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        }
      ];
      args: [];
    },
    {
      name: "initializeConfig";
      discriminator: [208, 127, 21, 1, 194, 190, 196, 70];
      accounts: [
        {
          name: "poolAuthority";
          writable: true;
          signer: true;
        },
        {
          name: "poolConfig";
          writable: true;
          signer: true;
        },
        {
          name: "activeMint";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "poolDepositPerUser";
          type: "u64";
        },
        {
          name: "poolRoundWinAllocation";
          type: "f32";
        },
        {
          name: "squadsAuthorityPubkey";
          type: "pubkey";
        }
      ];
    },
    {
      name: "pausePoolState";
      discriminator: [186, 42, 129, 90, 238, 2, 183, 82];
      accounts: [
        {
          name: "poolConfig";
          writable: true;
        },
        {
          name: "poolAuthority";
          signer: true;
        }
      ];
      args: [];
    },
    {
      name: "transferWinAllocation";
      discriminator: [207, 121, 154, 119, 193, 206, 132, 72];
      accounts: [
        {
          name: "poolAuthority";
          writable: true;
          signer: true;
        },
        {
          name: "poolConfig";
          writable: true;
        },
        {
          name: "winner";
          docs: ["CHECK : Winner's account"];
        },
        {
          name: "mint";
        },
        {
          name: "poolTokenAccount";
          writable: true;
        },
        {
          name: "winnerTokenAccount";
          writable: true;
        },
        {
          name: "squadsAuthority";
          docs: ["CHECK : Squads Authority"];
        },
        {
          name: "squadsTokenAccount";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "poolConfig";
      discriminator: [26, 108, 14, 123, 116, 230, 129, 43];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "invalidPoolDepositPerUser";
      msg: "Invalid pool deposit per user";
    },
    {
      code: 6001;
      name: "invalidPoolRoundWinAllocation";
      msg: "Invalid pool round win allocation";
    },
    {
      code: 6002;
      name: "poolAddressMismatch";
      msg: "Pool address mismatch";
    },
    {
      code: 6003;
      name: "mintAddressMismatch";
      msg: "Mint address mismatch";
    },
    {
      code: 6004;
      name: "poolIsNotActive";
      msg: "Pool is not active";
    },
    {
      code: 6005;
      name: "poolIsActive";
      msg: "Pool is already active";
    },
    {
      code: 6006;
      name: "mintIsAlreadyAdded";
      msg: "Mint is already added";
    },
    {
      code: 6007;
      name: "ownerMismatch";
      msg: "Owner mismatch";
    },
    {
      code: 6008;
      name: "insufficientBalance";
      msg: "Insufficient balance";
    },
    {
      code: 6009;
      name: "overflow";
      msg: "overflow";
    }
  ];
  types: [
    {
      name: "poolConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "poolState";
            type: {
              defined: {
                name: "poolState";
              };
            };
          },
          {
            name: "poolAddress";
            type: "pubkey";
          },
          {
            name: "poolAuthority";
            type: "pubkey";
          },
          {
            name: "poolActiveMint";
            type: "pubkey";
          },
          {
            name: "poolDepositPerUser";
            type: "u64";
          },
          {
            name: "poolRoundWinAllocation";
            type: "f32";
          },
          {
            name: "squadsAuthorityPubkey";
            type: "pubkey";
          },
          {
            name: "poolBalance";
            type: "f32";
          }
        ];
      };
    },
    {
      name: "poolState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "active";
          },
          {
            name: "inactive";
          }
        ];
      };
    }
  ];
};
export const IDL: OneDollarClub = {
  address: "HaebyXgGqUgGLQkY93CTm8iEC6gBjH1NU3Zgr7EG4wNW",
  metadata: {
    name: "oneDollarClub",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Created with Anchor",
  },
  instructions: [
    {
      name: "activatePoolState",
      discriminator: [212, 138, 44, 120, 39, 137, 118, 145],
      accounts: [
        {
          name: "poolConfig",
          writable: true,
        },
        {
          name: "poolAuthority",
          signer: true,
        },
      ],
      args: [],
    },
    {
      name: "changeDepositPerUser",
      discriminator: [200, 104, 204, 238, 225, 33, 120, 96],
      accounts: [
        {
          name: "poolConfig",
          writable: true,
        },
        {
          name: "poolAuthority",
          signer: true,
        },
      ],
      args: [
        {
          name: "poolDepositPerUser",
          type: "u64",
        },
      ],
    },
    {
      name: "changeMint",
      discriminator: [118, 99, 211, 172, 170, 106, 17, 38],
      accounts: [
        {
          name: "poolConfig",
          writable: true,
        },
        {
          name: "poolAuthority",
          signer: true,
        },
        {
          name: "mint",
        },
      ],
      args: [],
    },
    {
      name: "deposit",
      discriminator: [242, 35, 198, 137, 82, 225, 242, 182],
      accounts: [
        {
          name: "poolConfig",
          writable: true,
        },
        {
          name: "depositor",
          signer: true,
        },
        {
          name: "depositorTokenAccount",
          writable: true,
        },
        {
          name: "mint",
        },
        {
          name: "poolTokenAccount",
          writable: true,
        },
        {
          name: "tokenProgram",
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        },
      ],
      args: [],
    },
    {
      name: "initializeConfig",
      discriminator: [208, 127, 21, 1, 194, 190, 196, 70],
      accounts: [
        {
          name: "poolAuthority",
          writable: true,
          signer: true,
        },
        {
          name: "poolConfig",
          writable: true,
          signer: true,
        },
        {
          name: "activeMint",
        },
        {
          name: "systemProgram",
          address: "11111111111111111111111111111111",
        },
      ],
      args: [
        {
          name: "poolDepositPerUser",
          type: "u64",
        },
        {
          name: "poolRoundWinAllocation",
          type: "f32",
        },
        {
          name: "squadsAuthorityPubkey",
          type: "pubkey",
        },
      ],
    },
    {
      name: "pausePoolState",
      discriminator: [186, 42, 129, 90, 238, 2, 183, 82],
      accounts: [
        {
          name: "poolConfig",
          writable: true,
        },
        {
          name: "poolAuthority",
          signer: true,
        },
      ],
      args: [],
    },
    {
      name: "transferWinAllocation",
      discriminator: [207, 121, 154, 119, 193, 206, 132, 72],
      accounts: [
        {
          name: "poolAuthority",
          writable: true,
          signer: true,
        },
        {
          name: "poolConfig",
          writable: true,
        },
        {
          name: "winner",
          docs: ["CHECK : Winner's account"],
        },
        {
          name: "mint",
        },
        {
          name: "poolTokenAccount",
          writable: true,
        },
        {
          name: "winnerTokenAccount",
          writable: true,
        },
        {
          name: "squadsAuthority",
          docs: ["CHECK : Squads Authority"],
        },
        {
          name: "squadsTokenAccount",
          writable: true,
        },
        {
          name: "systemProgram",
          address: "11111111111111111111111111111111",
        },
        {
          name: "tokenProgram",
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "poolConfig",
      discriminator: [26, 108, 14, 123, 116, 230, 129, 43],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "invalidPoolDepositPerUser",
      msg: "Invalid pool deposit per user",
    },
    {
      code: 6001,
      name: "invalidPoolRoundWinAllocation",
      msg: "Invalid pool round win allocation",
    },
    {
      code: 6002,
      name: "poolAddressMismatch",
      msg: "Pool address mismatch",
    },
    {
      code: 6003,
      name: "mintAddressMismatch",
      msg: "Mint address mismatch",
    },
    {
      code: 6004,
      name: "poolIsNotActive",
      msg: "Pool is not active",
    },
    {
      code: 6005,
      name: "poolIsActive",
      msg: "Pool is already active",
    },
    {
      code: 6006,
      name: "mintIsAlreadyAdded",
      msg: "Mint is already added",
    },
    {
      code: 6007,
      name: "ownerMismatch",
      msg: "Owner mismatch",
    },
    {
      code: 6008,
      name: "insufficientBalance",
      msg: "Insufficient balance",
    },
    {
      code: 6009,
      name: "overflow",
      msg: "overflow",
    },
  ],
  types: [
    {
      name: "poolConfig",
      type: {
        kind: "struct",
        fields: [
          {
            name: "poolState",
            type: {
              defined: {
                name: "poolState",
              },
            },
          },
          {
            name: "poolAddress",
            type: "pubkey",
          },
          {
            name: "poolAuthority",
            type: "pubkey",
          },
          {
            name: "poolActiveMint",
            type: "pubkey",
          },
          {
            name: "poolDepositPerUser",
            type: "u64",
          },
          {
            name: "poolRoundWinAllocation",
            type: "f32",
          },
          {
            name: "squadsAuthorityPubkey",
            type: "pubkey",
          },
          {
            name: "poolBalance",
            type: "f32",
          },
        ],
      },
    },
    {
      name: "poolState",
      type: {
        kind: "enum",
        variants: [
          {
            name: "active",
          },
          {
            name: "inactive",
          },
        ],
      },
    },
  ],
};
