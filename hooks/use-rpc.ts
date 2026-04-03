'use client';

import { useState, useCallback } from 'react';
import SignClient from '@walletconnect/sign-client';

const PROJECT_ID = '13e0acf72bf9ae8d029db2c179276482'; //your wallet connect project id
const CHAIN_ID = 'chia:testnet'; //chia:mainnet for production 

const METHODS = [
  'chip0002_chainId',
  'chip0002_connect',
  'chip0002_getPublicKeys',
  'chip0002_filterUnlockedCoins',
  'chip0002_getAssetCoins',
  'chip0002_getAssetBalance',
  'chip0002_signCoinSpends',
  'chip0002_signMessage',
  'chip0002_sendTransaction',
  'chia_getNfts',
  'chia_getAddress',
  'chia_signMessageByAddress',
  'chia_bulkMintNfts',
  'chia_createOffer',
];

export interface RpcResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: any;
  error?: string;
}

export const useRpc = () => {
  const [client, setClient] = useState<SignClient | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [result, setResult] = useState<RpcResult>({ status: 'idle' });
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [wcUri, setWcUri] = useState<string | null>(null);

  const initializeClient = useCallback(async () => {
    try {
      const signClient = await SignClient.init({
        projectId: PROJECT_ID,
        relayUrl: 'wss://relay.walletconnect.com',
        metadata: {
          name: 'Sage - Bulk Minting',
          description: 'Tools for bulk minting nfts on chia network',
          url: typeof window !== 'undefined' ? window.location.origin : '',
          icons: ['https://walletconnect.com/walletconnect-logo.png'],
        },
      });

      setClient(signClient);

      if (signClient.session.length > 0) {
        const existingSession = signClient.session.getAll()[0];
        setSession(existingSession);
        
        const accounts = Object.values(existingSession.namespaces)
          .map((ns: any) => ns.accounts)
          .flat();
        if (accounts.length > 0) {
          setFingerprint(accounts[0].split(':')[2]);
        }
      }

      return signClient;
    } catch {
      throw new Error('Failed to initialize WalletConnect');
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setResult({ status: 'loading' });

      if (!client) {
        throw new Error('WalletConnect not initialized');
      }

      const { uri, approval } = await client.connect({
        optionalNamespaces: {
          chia: {
            methods: METHODS,
            chains: [CHAIN_ID],
            events: [],
          },
        },
      });

      if (uri) {
        setWcUri(uri);
        const newSession = await approval();
        setWcUri(null);

        setSession(newSession);
        
        const accounts = Object.values(newSession.namespaces)
          .map((ns: any) => ns.accounts)
          .flat();
        if (accounts.length > 0) {
          setFingerprint(accounts[0].split(':')[2]);
        }

        setResult({ status: 'success', data: newSession });
        return newSession;
      }
    } catch (error) {
      setWcUri(null);
      console.error('Connection failed:', error);
      setResult({ status: 'error', error: String(error) });
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [client]);

  const cancelConnect = useCallback(() => {
    setWcUri(null);
    setIsConnecting(false);
    setResult({ status: 'idle' });
  }, []);

  const disconnect = useCallback(async () => {
    if (client && session) {
      try {
        await client.disconnect({
          topic: session.topic,
          reason: { code: 6000, message: 'User disconnected' },
        });
      } catch {
      }
      setSession(null);
      setFingerprint(null);
      setResult({ status: 'idle' });
    }
  }, [client, session]);

  const callRpc = useCallback(
    async (method: string, params?: any) => {
      try {
        if (!client || !session) {
          throw new Error('Not connected to wallet');
        }

        const activeSessions = client.session.getAll();
        const isSessionActive = activeSessions.some(s => s.topic === session.topic);
        
        if (!isSessionActive) {
          setSession(null);
          setFingerprint(null);
          throw new Error('Session expired. Please reconnect your wallet.');
        }

        setResult({ status: 'loading' });

        const response = await client.request({
          topic: session.topic,
          chainId: CHAIN_ID,
          request: {
            method,
            params: params || {},
          },
        });

        const serializedResponse = JSON.parse(JSON.stringify(response));
        setResult({ status: 'success', data: serializedResponse });
        return serializedResponse;
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setResult({ status: 'error', error: errorMessage });
        throw error;
      }
    },
    [client, session]
  );

  const bulkMintNfts = useCallback(
    async (params: {
      did?: string;
      nfts?: Array<{
        dataUris?: string[];
        dataHash?: string;
        metadataUris?: string[];
        metadataHash?: string;
        licenseUris?: string[];
        licenseHash?: string | null;
        editionNumber?: number;
        editionTotal?: number;
        royaltyAddress?: string;
        royaltyTenThousandths?: number;
      }>;
      fee?: number;
      auto_submit?: boolean;
    }) => {
      return callRpc('chia_bulkMintNfts', params);
    },
    [callRpc]
  );

  const sendTransaction = useCallback(
    async (spendBundle: any) => {
      return callRpc('chip0002_sendTransaction', { spendBundle });
    },
    [callRpc]
  );

  const createOffer = useCallback(
    async (params: {
      offerAssets: any;
      requestAssets: any;
      fee?: number;
    }) => {
      return callRpc('chia_createOffer', params);
    },
    [callRpc]
  );

  const getAssetBalance = useCallback(
    async (type: string | null, assetId: string | null) => {
      return callRpc('chip0002_getAssetBalance', { type, assetId });
    },
    [callRpc]
  );

  const getAssetCoins = useCallback(
    async (type: string | null, assetId: string | null) => {
      return callRpc('chip0002_getAssetCoins', { type, assetId });
    },
    [callRpc]
  );

  const getPublicKeys = useCallback(async () => {
    return callRpc('chip0002_getPublicKeys', {});
  }, [callRpc]);

  const getNfts = useCallback(async (params?: { offset?: number; limit?: number; collectionId?: string }) => {
    return callRpc('chia_getNfts', params ?? {});
  }, [callRpc]);

  const getAddress = useCallback(async () => {
    return callRpc('chia_getAddress', {});
  }, [callRpc]);

  const transfer = useCallback(
    async (params: { to: string; amount: string; assetId?: string; fee?: number }) => {
      const spendBundle = {
        coin_spends: [
          {
            coin: { parent_coin_info: '0x0000000000000000000000000000000000000000000000000000000000000000', amount: BigInt(params.amount), puzzle_hash: '0x0000000000000000000000000000000000000000000000000000000000000000' },
            puzzle_reveal: '0xff',
            solution: '0xff',
          },
        ],
        aggregated_signature: '0xc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      };

      return callRpc('chip0002_sendTransaction', { spendBundle });
    },
    [callRpc]
  );

  return {
    client,
    session,
    isConnecting,
    result,
    fingerprint,
    wcUri,
    initializeClient,
    connect,
    cancelConnect,
    disconnect,
    callRpc,
    bulkMintNfts,
    sendTransaction,
    createOffer,
    getAssetBalance,
    getAssetCoins,
    getPublicKeys,
    getNfts,
    getAddress,
    transfer,
  };
};
