import { AnchorProvider, Program, Wallet, web3, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

import escrowIdl from './escrow.json';
import { Escrow } from './idlType';
import { config } from './config';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { isTokenProgram } from '@/utils';

export class EscrowProgram {
  protected program: Program<Escrow>;
  protected connection: web3.Connection;
  protected wallet: Wallet;

  constructor(connection: web3.Connection, wallet: Wallet) {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    this.program = new Program<Escrow>(escrowIdl as Escrow, provider);
    this.wallet = wallet;
    this.connection = connection;
  }

  createOfferId = (offerId: BN) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('offer'),
        this.wallet.publicKey.toBuffer(),
        offerId.toArrayLike(Buffer, 'le', 8),
      ],
      new PublicKey(config.contractAddress)
    )[0];
  };

  async makeOffer(
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    tokenAmountA: number,
    tokenAmountB: number
  ) {
    try {
      const [mintAInfo, mintBInfo] = await Promise.all([
        this.connection.getAccountInfo(tokenMintA),
        this.connection.getAccountInfo(tokenMintB),
      ]);

      if (!mintAInfo || !mintBInfo) {
        throw new Error('Mint not found');
      }

      const tokenProgramMintA = mintAInfo.owner;
      const tokenProgramMintB = mintBInfo.owner;

      if (tokenProgramMintA.toBase58() !== tokenProgramMintB.toBase58()) {
        throw new Error('Token programs do not match');
      }

      const tokenProgram = tokenProgramMintA;

      if (!isTokenProgram(tokenProgram)) {
        throw new Error('Program is not a token program');
      }
      
      const randomOfferId = new BN(Math.floor(Math.random() * 1000000000000));

      const makerTokenAccountA = getAssociatedTokenAddressSync(
        tokenMintA,
        this.wallet.publicKey,
        false,
        tokenProgram
      );

      const offerAddress = this.createOfferId(randomOfferId);

      const vault = getAssociatedTokenAddressSync(
        tokenMintA,
        offerAddress,
        true,
        tokenProgram
      );

      return this.program.methods
        .makeOffer(randomOfferId, tokenAmountA, tokenAmountB)
        .accounts({
          makerTokenAccountA,
          tokenMintA,
          tokenMintB,
          tokenProgram,
          vault,
        })
        .rpc();
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  async takeOffer(
    maker: PublicKey,
    offer: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey
  ) {
    try {
      const mintAInfo = await this.connection.getAccountInfo(tokenMintA);
      if (!mintAInfo) {
        throw new Error('Mint A not found');
      }
      const tokenProgramMint = mintAInfo.owner; // TODO: handle different token programs
      const makerTokenAccountB = getAssociatedTokenAddressSync(
        tokenMintB,
        maker,
        false,
        tokenProgramMint
      );
      const takerTokenAccountA = getAssociatedTokenAddressSync(
        tokenMintA,
        this.wallet.publicKey,
        false,
        tokenProgramMint
      );
      const takerTokenAccountB = getAssociatedTokenAddressSync(
        tokenMintB,
        this.wallet.publicKey,
        false,
        tokenProgramMint
      );
      const vault = getAssociatedTokenAddressSync(
        tokenMintA,
        offer,
        true,
        tokenProgramMint
      );
      return this.program.methods
        .takeOffer()
        .accounts({
          vault,
          tokenProgram: tokenProgramMint,
          makerTokenAccountB,
          takerTokenAccountA,
          takerTokenAccountB,
        })
        .rpc();
    } catch (e) {
      console.log(e);
      return null;
    }
  }
}
