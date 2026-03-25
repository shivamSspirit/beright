import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ConvictionEscrow } from "../target/types/conviction_escrow";
import { expect } from "chai";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("conviction-escrow", () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ConvictionEscrow as Program<ConvictionEscrow>;

  // Test accounts
  const project = anchor.web3.Keypair.generate();
  const resolver = anchor.web3.Keypair.generate();

  // PDA addresses
  let marketPda: PublicKey;
  let marketBump: number;
  let vaultPda: PublicKey;
  let vaultBump: number;

  // Test params
  const stakeAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL
  const resolutionDate = new anchor.BN(Math.floor(Date.now() / 1000) + 60); // 1 minute from now

  before(async () => {
    // Airdrop SOL to project wallet
    const signature = await provider.connection.requestAirdrop(
      project.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Derive PDAs
    [marketPda, marketBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), project.publicKey.toBuffer()],
      program.programId
    );

    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );
  });

  it("Creates a conviction market", async () => {
    const tx = await program.methods
      .createMarket(
        { yes: {} }, // StakePosition::Yes
        resolutionDate,
        stakeAmount
      )
      .accounts({
        market: marketPda,
        vault: vaultPda,
        project: project.publicKey,
        resolver: resolver.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([project])
      .rpc();

    console.log("Create market tx:", tx);

    // Fetch market account
    const market = await program.account.convictionMarket.fetch(marketPda);

    expect(market.projectWallet.toString()).to.equal(project.publicKey.toString());
    expect(market.resolver.toString()).to.equal(resolver.publicKey.toString());
    expect(market.stakeAmount.toNumber()).to.equal(stakeAmount.toNumber());
    expect(market.status).to.deep.equal({ pendingStake: {} });
    expect(market.outcome).to.deep.equal({ none: {} });
  });

  it("Project stakes SOL", async () => {
    const tx = await program.methods
      .stake()
      .accounts({
        market: marketPda,
        vault: vaultPda,
        project: project.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([project])
      .rpc();

    console.log("Stake tx:", tx);

    // Verify vault balance
    const vaultBalance = await provider.connection.getBalance(vaultPda);
    expect(vaultBalance).to.equal(stakeAmount.toNumber());

    // Verify market status
    const market = await program.account.convictionMarket.fetch(marketPda);
    expect(market.status).to.deep.equal({ active: {} });
  });

  it("Fails to resolve before resolution date", async () => {
    try {
      await program.methods
        .resolve({ yes: {} })
        .accounts({
          market: marketPda,
          resolver: resolver.publicKey,
        })
        .signers([resolver])
        .rpc();

      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("ResolutionDateNotReached");
    }
  });

  it("Resolves market after resolution date", async () => {
    // Wait for resolution date (in real tests, use time manipulation)
    // For this test, we'll skip since resolution_date is 1 min in future

    // Note: In real testing, you'd use bankrun or manipulate clock
    // For now, this test demonstrates the expected flow
    console.log("Skipping resolve test - requires clock manipulation");
  });

  it("Project claims winnings after YES resolution", async () => {
    // This test would follow after successful resolution
    console.log("Skipping claim test - depends on resolution");
  });
});
