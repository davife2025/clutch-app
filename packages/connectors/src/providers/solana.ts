import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
  Keypair,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import type { SigningConnector, TokenBalance, TxRequest, TxReceipt } from '../types.js'
import bs58 from 'bs58'

const KNOWN_SPL_TOKENS: Array<{ symbol: string; mint: string; decimals: number }> = [
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
  { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
  { symbol: 'PYTH', mint: 'HZ1JovNiVvGrCs7KMhgDsJMXnFHJf9S19R3MJQbPyBU6', decimals: 6 },
  { symbol: 'JTO', mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', decimals: 9 },
]

const DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS = 50_000 // 0.00005 SOL per CU
const DEFAULT_COMPUTE_UNIT_LIMIT = 200_000

/**
 * Production-grade Solana connector for Clutch.
 *
 * Features:
 *   - Versioned transactions (v0)
 *   - Priority fees via ComputeBudgetProgram
 *   - Automatic ATA creation for SPL transfers
 *   - Transaction confirmation with timeout
 */
export class SolanaConnector implements SigningConnector {
  readonly chain = 'solana' as const
  readonly name = 'Solana'
  private connection: Connection

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed')
  }

  async ping(): Promise<boolean> {
    try {
      await this.connection.getSlot()
      return true
    } catch {
      return false
    }
  }

  async getNativeBalance(address: string): Promise<bigint> {
    const pubkey = new PublicKey(address)
    const lamports = await this.connection.getBalance(pubkey)
    return BigInt(lamports)
  }

  async getBalances(address: string): Promise<TokenBalance[]> {
    const pubkey = new PublicKey(address)
    const results: TokenBalance[] = []

    // Native SOL
    const lamports = await this.connection.getBalance(pubkey)
    results.push({ token: 'SOL', amount: BigInt(lamports), decimals: 9 })

    // SPL tokens — parallel, ignore missing
    await Promise.allSettled(
      KNOWN_SPL_TOKENS.map(async (token) => {
        try {
          const mint = new PublicKey(token.mint)
          const ata = await getAssociatedTokenAddress(mint, pubkey)
          const account = await getAccount(this.connection, ata)
          if (account.amount > 0n) {
            results.push({
              token: token.symbol,
              amount: account.amount,
              decimals: token.decimals,
              contractAddress: token.mint,
            })
          }
        } catch {
          // Token account doesn't exist
        }
      }),
    )

    return results
  }

  async estimateGas(request: TxRequest): Promise<bigint> {
    // Solana fee = 5000 lamports per signature + priority fee
    const priorityMicroLamports =
      request.priorityFeeMicroLamports ?? DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS
    const computeUnits = request.computeUnitLimit ?? DEFAULT_COMPUTE_UNIT_LIMIT
    const priorityCost = BigInt(Math.ceil((priorityMicroLamports * computeUnits) / 1_000_000))
    return 5000n + priorityCost
  }

  async sendTransaction(request: TxRequest, privateKeyBase58: string): Promise<TxReceipt> {
    const secretKey = bs58.decode(privateKeyBase58)
    const keypair = Keypair.fromSecretKey(secretKey)
    const toPubkey = new PublicKey(request.to)

    const priorityMicroLamports =
      request.priorityFeeMicroLamports ?? DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS
    const computeUnits = request.computeUnitLimit ?? DEFAULT_COMPUTE_UNIT_LIMIT

    // Build instructions
    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityMicroLamports }),
    ]

    if (request.token === 'SOL') {
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey,
          lamports: Number(request.amount),
        }),
      )
    } else {
      const tokenInfo = KNOWN_SPL_TOKENS.find((t) => t.symbol === request.token)
      if (!tokenInfo) throw new Error(`Unknown SPL token: ${request.token}`)

      const mint = new PublicKey(tokenInfo.mint)
      const fromAta = await getAssociatedTokenAddress(mint, keypair.publicKey)
      const toAta = await getAssociatedTokenAddress(mint, toPubkey)

      // Check if recipient has the ATA — create it if not
      const toAtaInfo = await this.connection.getAccountInfo(toAta)
      if (!toAtaInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            keypair.publicKey, // payer
            toAta,
            toPubkey, // owner
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        )
      }

      instructions.push(
        createTransferInstruction(
          fromAta,
          toAta,
          keypair.publicKey,
          request.amount,
          [],
          TOKEN_PROGRAM_ID,
        ),
      )
    }

    // Build versioned transaction
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed')

    const message = new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message()

    const tx = new VersionedTransaction(message)
    tx.sign([keypair])

    // Send with confirmation
    const txHash = await this.connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: 'confirmed',
    })

    // Wait for confirmation
    const confirmation = await this.connection.confirmTransaction(
      { signature: txHash, blockhash, lastValidBlockHeight },
      'confirmed',
    )

    if (confirmation.value.err) {
      return {
        txHash,
        blockNumber: 0n,
        gasUsed: 5000n,
        status: 'reverted',
      }
    }

    const txInfo = await this.connection.getTransaction(txHash, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })

    return {
      txHash,
      blockNumber: BigInt(txInfo?.slot ?? 0),
      gasUsed: BigInt(txInfo?.meta?.fee ?? 5000),
      status: 'success',
    }
  }

  async signMessage(message: string, privateKeyBase58: string): Promise<string> {
    const { sign } = await import('tweetnacl')
    const secretKey = bs58.decode(privateKeyBase58)
    const keypair = Keypair.fromSecretKey(secretKey)
    const encoded = new TextEncoder().encode(message)
    const signature = sign.detached(encoded, keypair.secretKey)
    return bs58.encode(signature)
  }

  /** Check if a recipient address has an ATA for a given token. Used for fee preview. */
  async needsAtaCreation(toAddress: string, tokenSymbol: string): Promise<boolean> {
    const tokenInfo = KNOWN_SPL_TOKENS.find((t) => t.symbol === tokenSymbol)
    if (!tokenInfo || tokenSymbol === 'SOL') return false

    try {
      const toPubkey = new PublicKey(toAddress)
      const mint = new PublicKey(tokenInfo.mint)
      const toAta = await getAssociatedTokenAddress(mint, toPubkey)
      const info = await this.connection.getAccountInfo(toAta)
      return info === null
    } catch {
      return false
    }
  }
}
