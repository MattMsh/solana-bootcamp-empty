import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { TabsContent } from '@/components/ui/tabs';
import { ExternalLink, Loader2 } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { truncateAddress } from '@/utils';
import { Button } from '@/components/ui/button';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { useMetadata, formatTokenAmount } from '@/hooks/useMetadata';
import { PublicKey } from '@solana/web3.js';
import {
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

interface UserToken {
  mint: string;
  balance: number;
  decimals: number;
  programId: string;
}

function UserTokenItem({ token }: { token: UserToken }) {
  const { data: metadata, isLoading } = useMetadata(token.mint);
  // console.log(metadata)

  if (isLoading || !metadata) {
    return (
      <div className="flex items-center justify-between p-4 border rounded-lg mb-2">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading token metadata...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg mb-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-xl">{metadata?.icon}</span>
          <span className="font-medium">
            {formatTokenAmount(token.balance, token.decimals)}{' '}
            {metadata?.symbol}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={`https://explorer.solana.com/address/${token.mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-sm text-muted-foreground hover:text-primary"
              >
                {truncateAddress(token.mint)}
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <p>View token on Solana Explorer</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-xs text-muted-foreground">
          {token.programId === TOKEN_2022_PROGRAM_ID.toString()
            ? 'Token-2022'
            : 'SPL Token'}
        </span>
      </div>
    </div>
  );
}

export default function UserTokensPage({
  isWalletConnected,
  disconnect,
  setIsWalletConnected,
  loading,
}: {
  isWalletConnected: boolean;
  disconnect: () => void;
  setIsWalletConnected: (isWalletConnected: boolean) => void;
  loading: boolean;
}) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [tokens, setTokens] = useState<UserToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchUserTokens() {
      if (!publicKey || !isWalletConnected) {
        setTokens([]);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch token accounts owned by the wallet
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          {
            programId: TOKEN_PROGRAM_ID,
          }
        );

        // Fetch token accounts for Token-2022 program
        const token2022Accounts =
          await connection.getParsedTokenAccountsByOwner(publicKey, {
            programId: TOKEN_2022_PROGRAM_ID,
          });

        // Combine all token accounts
        const allAccounts = [
          ...tokenAccounts.value.map((account) => ({
            ...account,
            programId: TOKEN_PROGRAM_ID.toString(),
          })),
          ...token2022Accounts.value.map((account) => ({
            ...account,
            programId: TOKEN_2022_PROGRAM_ID.toString(),
          })),
        ];

        // Process token accounts
        const userTokens: UserToken[] = [];

        for (const account of allAccounts) {
          const parsedInfo = account.account.data.parsed.info;
          const mintAddress = parsedInfo.mint;
          const balance = Number(parsedInfo.tokenAmount.amount);

          // Skip tokens with zero balance
          if (balance === 0) continue;

          // Get decimals
          const mint = await getMint(
            connection,
            new PublicKey(mintAddress),
            'confirmed',
            account.programId === TOKEN_2022_PROGRAM_ID.toString()
              ? TOKEN_2022_PROGRAM_ID
              : TOKEN_PROGRAM_ID
          );

          userTokens.push({
            mint: mintAddress,
            balance,
            decimals: mint.decimals,
            programId: account.programId,
          });
        }

        setTokens(userTokens);
      } catch (error) {
        console.error('Error fetching token accounts:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserTokens();
  }, [publicKey, connection, isWalletConnected]);

  return (
    <TabsContent value="userTokens">
      <Card>
        <CardHeader className="flex flex-row justify-between">
          <div>
            <CardTitle>Your Tokens</CardTitle>
            <CardDescription>
              View tokens you own in your wallet.
            </CardDescription>
          </div>
          {isWalletConnected ? (
            <div>
              <Button
                onClick={() => {
                  try {
                    disconnect();
                    setIsWalletConnected(false);
                  } catch (e) {
                    console.log('Error disconnecting', e);
                  }
                }}
              >
                Disconnect
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!isWalletConnected ? (
              <div className="text-center py-8">
                <p className="mb-4 text-muted-foreground">
                  Connect your wallet to view your tokens
                </p>
                <WalletMultiButton style={{ backgroundColor: 'black' }}>
                  <Button asChild disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <div>Connect Wallet</div>
                    )}
                  </Button>
                </WalletMultiButton>
              </div>
            ) : (
              <>
                {isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Loading your tokens...
                    </p>
                  </div>
                ) : (
                  <>
                    {tokens.length > 0 ? (
                      tokens.map((token) => (
                        <UserTokenItem key={token.mint} token={token} />
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          No tokens found in your wallet
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
