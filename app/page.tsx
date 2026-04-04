'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'; 
import Image from 'next/image';
import { useRpc } from '@/hooks/use-rpc';
import { QrModal } from '@/components/qr-modal';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  ExternalLink, 
  Loader2, 
  Check, 
  Layers, 
  Package, 
  Tags,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Download,
  ChevronDown
} from 'lucide-react';

const MINT_CONFIG = {
  totalSupply: 1000, //how many nft you want to mint recommend 100-1000
  batchSize: 20, //max 25
  royaltyAddress: 'xch.....', //chia address to receiving royalties
  royaltyPercent: 5, //default
  did: 'did:chia:....', //did profile
  baseImageUri: 'https://gateway.lighthouse.storage/ipfs/yourcid.../', //lighthouse pinata or your own link
  baseMetadataUri: 'https://gateway.lighthouse.storage/ipfs/yourcid.../', //lighthouse pinata or your own link
  licenseUri: 'example.com/license', // your license url
  spacescanBase: 'https://testnet11.spacescan.io/nft/', //used https://spacescan.io/nft/ for mainnet
};

type Tab = 'bulk-mint' | 'minted' | 'bulk-offer';
type MintStatus = 'pending' | 'minting' | 'confirming' | 'minted' | 'error';

interface NFTItem {
  id: number;
  status: MintStatus;
  nftId?: string;
  error?: string;
}

interface MintedNFT {
  nftId: string;
  editionNumber: number;
  imageUri: string;
  launcherId: string;
  name: string;
}

export default function Home() {
  const rpc = useRpc();
  const rpcRef = useRef(rpc);
  rpcRef.current = rpc; // Always keep ref up to date
  const initCalled = useRef(false);
  
  const [activeTab, setActiveTab] = useState<Tab>('bulk-mint');
  const [nftItems, setNftItems] = useState<NFTItem[]>(() => 
    Array.from({ length: MINT_CONFIG.totalSupply }, (_, i) => ({
      id: i + 1,
      status: 'pending' as MintStatus,
    }))
  );
  const [mintedNfts, setMintedNfts] = useState<MintedNFT[]>([]);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [isMinting, setIsMinting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [autoMint, setAutoMint] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [isRejected, setIsRejected] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isFetchingNfts, setIsFetchingNfts] = useState(false);
  const [isInitialFetching, setIsInitialFetching] = useState(false);
  const [allNftsData, setAllNftsData] = useState<{nft: MintedNFT; collectionId: string}[]>([]);
  const [collections, setCollections] = useState<{id: string; name: string; imageUri: string}[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  
  const [offerPrice, setOfferPrice] = useState('0.1');
  const [isCreatingOffers, setIsCreatingOffers] = useState(false);
  const [createdOffers, setCreatedOffers] = useState<{offer: string; editionNumber: number; launcherId: string; name: string; collectionId: string | null}[]>([]);
  const [offerProgress, setOfferProgress] = useState(0);
  const [isOfferPausing, setIsOfferPausing] = useState(false);
  const [offerStopped, setOfferStopped] = useState(false);
  const offerPauseRef = useRef(false);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFrom, setDownloadFrom] = useState(1);
  const [downloadTo, setDownloadTo] = useState(1);

  useEffect(() => {
    if (rpc.fingerprint) {
      const storageKey = `offers_${rpc.fingerprint}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCreatedOffers(parsed);
        } catch {}
      }
    } else {
      setCreatedOffers([]);
    }
  }, [rpc.fingerprint]);

  useEffect(() => {
    if (rpc.fingerprint && createdOffers.length > 0) {
      const storageKey = `offers_${rpc.fingerprint}`;
      localStorage.setItem(storageKey, JSON.stringify(createdOffers));
    }
  }, [createdOffers, rpc.fingerprint]);

  const filteredMintedNfts = useMemo(() => {
    if (!selectedCollection) return [];
    return allNftsData
      .filter(n => n.collectionId === selectedCollection)
      .map(n => n.nft);
  }, [allNftsData, selectedCollection]);

  const filteredOffers = useMemo(() => {
    return createdOffers.filter(o => o.collectionId === selectedCollection);
  }, [createdOffers, selectedCollection]);

  const highestOfferEdition = useMemo(() => {
    if (filteredOffers.length === 0) return 0;
    return Math.max(...filteredOffers.map(o => o.editionNumber));
  }, [filteredOffers]);

  const nftsWithoutOffers = useMemo(() => {
    const offerLaunchers = new Set(filteredOffers.map(o => o.launcherId));
    return filteredMintedNfts.filter(nft => !offerLaunchers.has(nft.launcherId));
  }, [filteredMintedNfts, filteredOffers]);

  useEffect(() => {
    setMintedNfts(filteredMintedNfts);
    
    const mintedEditions = new Set(filteredMintedNfts.map(n => n.editionNumber));
    const highestEdition = filteredMintedNfts.length > 0 
      ? Math.max(...filteredMintedNfts.map(n => n.editionNumber))
      : 0;
    
    setNftItems(prev => prev.map(item => {
      if (mintedEditions.has(item.id)) return { ...item, status: 'minted' as MintStatus };
      if (item.id <= highestEdition) return { ...item, status: 'minted' as MintStatus };
      if (item.status === 'confirming') return item;
      return { ...item, status: 'pending' as MintStatus };
    }));
  }, [filteredMintedNfts]);

  useEffect(() => {
    if (!selectedCollection) return;
    
    const mintedEditions = new Set(filteredMintedNfts.map(n => n.editionNumber));
    const highestEdition = filteredMintedNfts.length > 0 
      ? Math.max(...filteredMintedNfts.map(n => n.editionNumber))
      : 0;

    setNftItems(Array.from({ length: MINT_CONFIG.totalSupply }, (_, i) => {
      const id = i + 1;
      if (mintedEditions.has(id) || id <= highestEdition) {
        return { id, status: 'minted' as MintStatus };
      }
      return { id, status: 'pending' as MintStatus };
    }));
    
    setIsConfirming(false);
    setIsMinting(false);
    setIsPausing(false);
  }, [selectedCollection]);

  const totalBatches = Math.ceil(MINT_CONFIG.totalSupply / MINT_CONFIG.batchSize);
  const mintedCount = filteredMintedNfts.length;
  const confirmingCount = nftItems.filter(n => n.status === 'confirming').length;
  
  const highestMintedEdition = useMemo(() => {
    if (mintedNfts.length === 0) return 0;
    return Math.max(...mintedNfts.map(n => n.editionNumber));
  }, [mintedNfts]);
  
  const progress = (highestMintedEdition / MINT_CONFIG.totalSupply) * 100;

  const nextBatchToMint = useMemo(() => {
    const hasPending = nftItems.some(item => item.status === 'pending');
    const hasConfirming = nftItems.some(item => item.status === 'confirming');
    if (hasPending && !hasConfirming) return 0;
    return -1;
  }, [nftItems]);

  const currentMintingItems = useMemo(() => {
    const items = nftItems.filter(item => item.status === 'minting' || item.status === 'confirming');
    if (items.length > 0) return items;
    return nftItems.filter(item => item.status === 'pending').slice(0, MINT_CONFIG.batchSize);
  }, [nftItems]);

  useEffect(() => {
    if (initCalled.current) return;
    initCalled.current = true;
    rpc.initializeClient().catch(() => {});
  }, []);

  const fetchMintedNfts = useCallback(async () => {
    if (!rpcRef.current.session || isFetchingNfts) return [];
    
    setIsFetchingNfts(true);
    
    try {
      const allNfts: any[] = [];
      let offset = 0;
      const limit = 50;
      let hasMore = true;
      
      while (hasMore) {
        const result = await rpcRef.current.getNfts({ limit, offset });
        const nfts = result?.nfts ?? [];
        
        if (nfts.length > 0) {
          allNfts.push(...nfts);
          offset += nfts.length;
          if (nfts.length < limit) hasMore = false;
        } else {
          hasMore = false;
        }
        
        if (offset >= 1000) hasMore = false;
      }
      
      const allNftsWithCollection = allNfts
        .map((nft: any) => {
          const uri = nft.dataUris?.[0] ?? nft.data_uris?.[0];
          const edition = nft.editionNumber ?? nft.edition_number ?? 0;
          const launcher = nft.launcherId ?? nft.launcher_id ?? '';
          const colId = nft.collectionId ?? nft.collection_id ?? 'unknown';
          const nftName = nft.name ?? '';
          return {
            nft: {
              nftId: launcher,
              editionNumber: edition,
              imageUri: uri && typeof uri === 'string' && uri.trim() ? uri.trim() : '',
              launcherId: launcher,
              name: nftName,
            },
            collectionId: colId,
          };
        });
      
      setAllNftsData(allNftsWithCollection);
      
      const collectionMap = new Map<string, {id: string; name: string; imageUri: string; count: number}>();
      allNfts.forEach((nft: any) => {
        const colId = nft.collectionId ?? nft.collection_id ?? 'unknown';
        if (!collectionMap.has(colId)) {
          collectionMap.set(colId, {
            id: colId,
            name: nft.collectionName ?? nft.collection_name ?? '',
            imageUri: nft.dataUris?.[0] ?? nft.data_uris?.[0] ?? '',
            count: 1,
          });
        } else {
          collectionMap.get(colId)!.count++;
        }
      });
      const uniqueCollections = Array.from(collectionMap.values());
      setCollections(uniqueCollections);
      
      const collectionIds = uniqueCollections.map(c => c.id);
      if (selectedCollection && !collectionIds.includes(selectedCollection)) {
        setSelectedCollection(null);
      }
      
      return allNftsWithCollection;
    } catch {
      return [];
    } finally {
      setIsFetchingNfts(false);
    }
  }, [isFetchingNfts, selectedCollection]);

  const hasSession = Boolean(rpc.session);
  const canAutoMint = autoMint && !isMinting && !isConfirming && nextBatchToMint !== -1 && hasSession;
  const initialFetchDone = useRef(false);
  
  const selectedCollectionIsAllowed = useMemo(() => {
    if (!selectedCollection) return true;
    const collectionNfts = allNftsData.filter(n => n.collectionId === selectedCollection);
    if (collectionNfts.length === 0) return true;
    const editionCounts: Record<number, number> = {};
    collectionNfts.forEach(n => {
      const edition = Number(n.nft.editionNumber) || 0;
      editionCounts[edition] = (editionCounts[edition] || 0) + 1;
    });
    const hasDuplicateEditions = Object.values(editionCounts).some(count => count >= 3);
    return !hasDuplicateEditions;
  }, [selectedCollection, allNftsData]);

  useEffect(() => {
    if (hasSession && !initialFetchDone.current && mintedNfts.length === 0) {
      initialFetchDone.current = true;
      setIsInitialFetching(true);
      fetchMintedNfts().finally(() => setIsInitialFetching(false));
    } else if (hasSession && !initialFetchDone.current && mintedNfts.length > 0) {
      initialFetchDone.current = true;
    }
    if (!hasSession) {
      initialFetchDone.current = false;
      setMintedNfts([]);
      setAllNftsData([]);
      setCollections([]);
      setSelectedCollection(null);
      setNftItems(prev => prev.map(item => ({ ...item, status: 'pending' as MintStatus, nftId: undefined, error: undefined })));
      setAutoMint(false);
      setMintError(null);
      setIsInitialFetching(false);
    }
  }, [hasSession, fetchMintedNfts, mintedNfts.length]);

  useEffect(() => {
    if (canAutoMint) {
      handleMintBatch(nextBatchToMint);
    }
  }, [canAutoMint]);

  const [isConnecting, setIsConnecting] = useState(false);

  async function handleConnect() {
    setIsConnecting(true);
    try { 
      await rpc.connect(); 
    } catch { 
    } finally {
      setIsConnecting(false);
    }
  }

  async function computeHash(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function handleMintBatch(batchIndex: number) {
    if (!rpc.session) { 
      await handleConnect(); 
      return; 
    }

    setIsMinting(true);
    setMintError(null);
    setCurrentBatch(batchIndex);

    const batchItems = nftItems
      .filter(item => item.status === 'pending')
      .slice(0, MINT_CONFIG.batchSize);
    
    if (batchItems.length === 0) {
      setIsMinting(false);
      return;
    }

    setNftItems(prev => prev.map(item => 
      batchItems.some(b => b.id === item.id) 
        ? { ...item, status: 'minting' as MintStatus }
        : item
    ));

    try {
      const mints = [];
      for (const item of batchItems) {
        const imageUrl = `${MINT_CONFIG.baseImageUri}${item.id}.png`;
        const metadataUrl = `${MINT_CONFIG.baseMetadataUri}${item.id}.json`;
        
        const imgRes = await fetch(imageUrl);
        const imgData = await imgRes.arrayBuffer();
        const dataHash = await computeHash(imgData);
        
        const metaRes = await fetch(metadataUrl);
        const metaData = await metaRes.arrayBuffer();
        const metadataHash = await computeHash(metaData);
        
        let licenseHash = null;
        try {
          const licenseRes = await fetch(MINT_CONFIG.licenseUri);
          const licenseData = await licenseRes.arrayBuffer();
          licenseHash = await computeHash(licenseData);
        } catch {
        }
        
        mints.push({
          dataUris: [imageUrl],
          dataHash,
          metadataUris: [metadataUrl],
          metadataHash,
          licenseUris: [MINT_CONFIG.licenseUri],
          licenseHash,
          editionNumber: item.id,
          editionTotal: MINT_CONFIG.totalSupply,
          royaltyAddress: MINT_CONFIG.royaltyAddress,
          royaltyTenThousandths: MINT_CONFIG.royaltyPercent * 100,
        });
      }

      let result;
      try {
        result = await rpc.bulkMintNfts({ 
          did: MINT_CONFIG.did, 
          nfts: mints,
          fee: 0,
          auto_submit: true,
        });
      } catch (error) {
        setIsMinting(false);
        setAutoMint(false);
        setMintError('Connection error. Please try again.');
        setNftItems(prev => prev.map(item => 
          batchItems.some(b => b.id === item.id) 
            ? { ...item, status: 'pending' as MintStatus }
            : item
        ));
        return;
      }

      if (!result) {
        setIsMinting(false);
        setAutoMint(false);
        setIsRejected(true);
        setTimeout(() => setIsRejected(false), 2000);
        setNftItems(prev => prev.map(item => 
          batchItems.some(b => b.id === item.id) 
            ? { ...item, status: 'pending' as MintStatus }
            : item
        ));
        return;
      }

      const nftIds: string[] = result?.nft_ids ?? result?.nftIds ?? [];

      setNftItems(prev => prev.map((item) => {
        const batchItemIndex = batchItems.findIndex(b => b.id === item.id);
        if (batchItemIndex !== -1) {
          return { 
            ...item, 
            status: 'confirming' as MintStatus,
            nftId: nftIds[batchItemIndex] ?? undefined
          };
        }
        return item;
      }));

      setIsMinting(false);
      setIsConfirming(true);

      await new Promise(resolve => setTimeout(resolve, 45000));

      await fetchMintedNfts();

      setNftItems(prev => prev.map((item) => {
        const batchItemIndex = batchItems.findIndex(b => b.id === item.id);
        if (batchItemIndex !== -1) {
          return { ...item, status: 'minted' as MintStatus };
        }
        return item;
      }));

      setIsConfirming(false);
      setIsPausing(false);

    } catch (err: any) {
      const errorMsg = err?.message ?? String(err);
      const isUserRejection = 
        errorMsg.includes('User rejected') || 
        errorMsg.includes('User denied') ||
        errorMsg.includes('rejected') ||
        errorMsg.includes('cancelled') ||
        errorMsg.includes('canceled') ||
        err?.code === 4001 ||
        err?.code === 'ACTION_REJECTED';
      
      const isRelayError = 
        errorMsg.includes('relay') ||
        errorMsg.includes('onRelayMessage') ||
        errorMsg.includes('Connection') ||
        errorMsg.includes('Network');
      
      setAutoMint(false);
      
      if (isUserRejection) {
        setIsRejected(true);
        setTimeout(() => setIsRejected(false), 2000);
      } else if (isRelayError) {
        setMintError('Network connection lost. Please check your connection and try again.');
      } else {
        setMintError(errorMsg);
      }
      
      setNftItems(prev => prev.map(item => 
        batchItems.some(b => b.id === item.id) 
          ? { ...item, status: (isUserRejection || isRelayError) ? 'pending' as MintStatus : 'error' as MintStatus, error: (isUserRejection || isRelayError) ? undefined : errorMsg }
          : item
      ));
      setIsMinting(false);
      setIsConfirming(false);
      setIsPausing(false);
    }
  }

  async function resetMinting() {
    setAutoMint(false);
    setIsMinting(false);
    setIsConfirming(false);
    setIsRejected(false);
    setIsPausing(false);
    setCurrentBatch(0);
    setMintError(null);
    await fetchMintedNfts();
  }

  function retryErrors() {
    setNftItems(prev => prev.map(item => 
      item.status === 'error' ? { ...item, status: 'pending' as MintStatus, error: undefined } : item
    ));
  }

  const tabs = [
  { id: 'bulk-mint' as Tab, label: 'Bulk Mint', shortLabel: 'Mint', icon: Layers },
  { id: 'minted' as Tab, label: 'History', shortLabel: 'History', icon: Package, count: mintedCount },
  { id: 'bulk-offer' as Tab, label: 'Bulk Offers', shortLabel: 'Offers', icon: Tags },
  ];

  return (
    <>
      {rpc.wcUri && <QrModal uri={rpc.wcUri} onClose={rpc.cancelConnect} />}

      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        {/* HEADER */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <span className="font-semibold tracking-tight text-sm sm:text-base">Sage Bulk Minting</span>

            <div className="flex items-center gap-2 sm:gap-4">
              {rpc.session ? (
                <button
                  onClick={() => rpc.disconnect()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="truncate max-w-32">
                    {rpc.fingerprint ?? 'Connected'}
                  </span>
                </button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConnect}
                  disabled={rpc.isConnecting}
                >
                  {rpc.isConnecting
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Connecting</>
                    : 'Sage Connect'
                  }
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="border-b border-border bg-card">
          <div className="w-full px-4 sm:px-6">
            <nav className="flex justify-start sm:justify-center md:justify-start gap-0 md:gap-8">
              {tabs.map((tab, idx) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 md:px-8 py-3 text-xs sm:text-sm md:text-base font-medium border-b-2 transition-colors ${
                    idx === 0 ? 'flex-1 md:flex-none md:mr-auto' : 
                    idx === 1 ? 'flex-1 md:flex-none md:mx-auto' : 
                    'flex-1 md:flex-none md:ml-auto'
                  } ${
                    activeTab === tab.id
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden md:inline">{tab.label}</span>
                  <span className="md:hidden">{tab.shortLabel}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-0.5 sm:ml-1 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs md:text-sm rounded-full bg-primary/10 text-primary">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <main className="flex-1 py-6 md:py-10 lg:py-12">
          <div className="w-full px-4 sm:px-6 lg:px-8">

            {activeTab === 'bulk-mint' && (
              <div className="flex items-center justify-center min-h-[70vh] overflow-auto">
                <div className="w-full max-w-lg md:max-w-2xl bg-card border border-border rounded-2xl p-4 sm:p-8 md:p-12 text-center space-y-8 my-4">
                  <div className="relative w-40 h-40 sm:w-56 sm:h-56 md:w-64 md:h-64 mx-auto flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-secondary"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        className="text-primary transition-all duration-500"
                        strokeDasharray={440}
                        strokeDashoffset={440 - (440 * progress) / 100}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl sm:text-5xl md:text-6xl font-bold">{highestMintedEdition}</span>
                      <span className="text-sm sm:text-base md:text-lg text-muted-foreground">/ {MINT_CONFIG.totalSupply}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-lg sm:text-xl md:text-2xl font-medium">
                      {nextBatchToMint === -1 && !isConfirming
                        ? 'All NFTs Minted!' 
                        : isConfirming
                        ? 'Waiting for confirmation...'
                        : isMinting && currentMintingItems.length > 0
                        ? `Minting #${currentMintingItems[0].id} - #${currentMintingItems[currentMintingItems.length - 1].id}...`
                        : autoMint
                        ? 'Auto-minting in progress'
                        : 'Ready to mint'}
                    </p>
                    <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
                      {isConfirming 
                        ? `${confirmingCount} NFTs pending in mempool`
                        : `${MINT_CONFIG.batchSize} NFTs per transaction`}
                    </p>
                  </div>

                  {mintError && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm sm:text-base text-destructive">
                      {mintError}
                    </div>
                  )}
                  {rpc.session && nextBatchToMint === -1 && !isConfirming && (
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full gap-2 h-12 md:h-14 text-base md:text-lg"
                      onClick={resetMinting}
                    >
                      <RotateCcw className="w-5 h-5" />
                      Refresh Status
                    </Button>
                  )}
                  <div className="w-full space-y-3">
                    <Button
                      size="lg"
                      className={`w-full gap-2 h-12 md:h-14 text-base md:text-lg ${isRejected ? 'bg-destructive hover:bg-destructive text-destructive-foreground' : ''}`}
                      onClick={() => {
                        if (!autoMint && !isMinting && !isConfirming && !isRejected) {
                          setAutoMint(true);
                          if (nextBatchToMint !== -1) {
                            handleMintBatch(nextBatchToMint);
                          }
                        }
                      }}
                      disabled={!rpc.session || isMinting || isConfirming || autoMint || isRejected || isInitialFetching || (selectedCollection && !selectedCollectionIsAllowed)}
                    >
                      {isRejected ? (
                        <>Rejected</>
                      ) : isInitialFetching ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />Fletching Data...</>
                      ) : selectedCollection && !selectedCollectionIsAllowed ? (
                        <>Not Allowed</>
                      ) : isConfirming ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />Confirming...</>
                      ) : isMinting ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />Minting...</>
                      ) : autoMint ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />Running...</>
                      ) : (
                        <><Play className="w-5 h-5" />Start Auto-Mint</>
                      )}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full gap-2 h-12 md:h-14 text-base md:text-lg"
                      onClick={() => {
                        setAutoMint(false);
                        setIsPausing(true);
                      }}
                      disabled={!rpc.session || !isConfirming || isPausing}
                    >
                      {isPausing ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />Pausing...</>
                      ) : (
                        <><Pause className="w-5 h-5" />Pause</>
                      )}
                    </Button>
                  </div>

                  {rpc.session && nftItems.some(n => n.status === 'error') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={retryErrors}
                      className="gap-2 text-muted-foreground"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Retry failed items
                    </Button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'minted' && (
              <div className="space-y-6 md:space-y-8">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold">Minted NFTs</h2>
                <div className="flex items-center justify-between gap-4">
                  {collections.length > 0 ? (
                    <div className="relative max-w-[200px] sm:max-w-[250px] md:max-w-[300px]">
                      <select
                        value={selectedCollection || ''}
                        onChange={(e) => setSelectedCollection(e.target.value || null)}
                        className="appearance-none w-full px-3 pr-8 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer truncate"
                      >
                        <option value="">New Collection</option>
                        {collections.map((col, idx) => {
                          const name = col.name || `${col.id.slice(0, 6)}...${col.id.slice(-4)}`;
                          const count = allNftsData.filter(n => n.collectionId === col.id).length;
                          const displayName = name.length > 20 ? `${name.slice(0, 20)}...` : name;
                          return (
                            <option key={`${col.id}-${idx}`} value={col.id}>
                              {displayName} ({count})
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
                    </div>
                  ) : (
                    <div />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchMintedNfts}
                    disabled={isFetchingNfts || !rpc.session}
                    className="gap-2 text-sm md:text-base"
                  >
                    {isFetchingNfts ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    Refresh
                  </Button>
                </div>

                {!rpc.session ? (
                  <div className="border border-dashed border-border rounded-xl p-12 md:p-20 text-center">
                    <Package className="w-16 h-16 md:w-20 md:h-20 mx-auto text-muted-foreground/50 mb-6" />
                    <p className="text-lg md:text-xl text-muted-foreground">Connect wallet to view minted NFTs</p>
                  </div>
                ) : filteredMintedNfts.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl p-12 md:p-20 text-center">
                    <Package className="w-16 h-16 md:w-20 md:h-20 mx-auto text-muted-foreground/50 mb-6" />
                    <p className="text-lg md:text-xl text-muted-foreground">
                      {isFetchingNfts ? 'Loading NFTs...' : collections.length === 0 ? 'No NFTs found in wallet' : 'No NFTs in selected collection'}
                    </p>
                    <p className="text-sm md:text-base text-muted-foreground/70 mt-3">Start minting from the Bulk Mint tab</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4 md:gap-5">
                    {filteredMintedNfts
                      .sort((a, b) => a.editionNumber - b.editionNumber)
                      .map((nft, index) => (
                      <div
                          key={`nft-${nft.launcherId || nft.nftId}-${nft.editionNumber}-${index}`}
                          className="bg-card border border-border rounded-lg md:rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
                      >
                        <div className="aspect-square bg-secondary relative">
                          {(() => {
                            const imgSrc = nft.imageUri?.trim();
                            if (imgSrc && imgSrc.length > 0 && imgSrc.startsWith('http')) {
                              return (
                                <Image
                                  src={imgSrc}
                                  alt={`NFT #${nft.editionNumber}`}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              );
                            }
                            return <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No image</div>;
                          })()}
                        </div>
                        <div className="p-2 md:p-3 space-y-1 md:space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-xs md:text-sm truncate max-w-[60%]" title={nft.name || 'No name'}>
                              {nft.name || 'No name'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {nft.editionNumber > 0 ? `#${nft.editionNumber}` : 'None'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] md:text-xs text-muted-foreground truncate max-w-[80%]" title={nft.nftId}>
                              {nft.nftId.slice(0, 8)}...{nft.nftId.slice(-6)}
                            </p>
                            <a
                              href={`${MINT_CONFIG.spacescanBase}${nft.nftId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3 md:w-4 md:h-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bulk-offer' && (
              <div className="space-y-6 md:space-y-8 w-full">
                <div className="bg-card border border-border rounded-xl p-6 md:p-12">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-4 md:mb-6">Create Bulk Offers</h2>
                  <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 md:mb-10">
                    Create sell offers for all your minted NFTs at once.
                  </p>

                  <div className="space-y-4 md:space-y-6 w-full">
                    <div>
                      <label className="block text-base md:text-lg font-medium mb-3">Price per NFT (XCH)</label>
                      <input
                        type="text"
                        value={offerPrice}
                        onChange={(e) => setOfferPrice(e.target.value)}
                        className="w-full px-6 py-4 md:py-5 text-base md:text-lg rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="0.1"
                      />
                    </div>

                    <Separator />

                    <div className="text-base md:text-lg text-muted-foreground space-y-2">
                      <p>
                        {nftsWithoutOffers.length === 0 
                          ? `All ${mintedNfts.length} NFTs already have offers`
                          : `This will create ${nftsWithoutOffers.length} offers at ${offerPrice} XCH each`}
                      </p>
                      
                      <p className="font-medium text-foreground">
                        Total potential: {(parseFloat(offerPrice || '0') * mintedNfts.length).toFixed(2)} XCH
                      </p>
                    </div>

                    <Button
                      onClick={async () => {
                        if (!rpc.session) {
                          await handleConnect();
                          return;
                        }
                        setIsCreatingOffers(true);
                        setMintError(null);
                        setOfferProgress(0);
                        setOfferStopped(false);
                        offerPauseRef.current = false;
                        
                        try {
                          const nftsToProcess = nftsWithoutOffers.sort((a, b) => a.editionNumber - b.editionNumber);
                          
                          for (let i = 0; i < nftsToProcess.length; i++) {
                            if (offerPauseRef.current) {
                              setOfferStopped(true);
                              setTimeout(() => setOfferStopped(false), 2000);
                              setIsOfferPausing(false);
                              setIsCreatingOffers(false);
                              return;
                            }
                            
                            const nft = nftsToProcess[i];
                            setOfferProgress(filteredOffers.length + i + 1);
                            
                            try {
                              const priceNumber = Math.floor(parseFloat(offerPrice) * 1_000_000_000_000);
                              const offerParams = {
                                offerAssets: [
                                  { assetId: nft.launcherId, amount: 1 }
                                ],
                                requestAssets: [
                                  { assetId: '', amount: priceNumber }
                                ],
                                fee: 0,
                              };
                              const result = await rpc.createOffer(offerParams);
                              
                              if (!result) {
                                setOfferStopped(true);
                                setTimeout(() => setOfferStopped(false), 2000);
                                setIsCreatingOffers(false);
                                setIsOfferPausing(false);
                                return;
                              }
                              
                               if (result?.offer) {
                               setCreatedOffers(prev => [...prev, { offer: result.offer, editionNumber: nft.editionNumber, launcherId: nft.launcherId, name: nft.name, collectionId: selectedCollection }]);
                               }
                            } catch (err: any) {
                              const errorMsg = err?.message ?? String(err);
                              const isUserRejection = 
                                errorMsg.includes('rejected') || 
                                errorMsg.includes('denied') ||
                                errorMsg.includes('cancelled') ||
                                errorMsg.includes('canceled') ||
                                err?.code === 4001 ||
                                err?.code === 'ACTION_REJECTED';
                              
                              if (isUserRejection) {
                                setOfferStopped(true);
                                setTimeout(() => setOfferStopped(false), 2000);
                                setIsCreatingOffers(false);
                                setIsOfferPausing(false);
                                return;
                              }
                            }
                          }
                        } catch (err: any) {
                          setMintError(err?.message || 'Failed to create offers');
                        } finally {
                          setIsCreatingOffers(false);
                          setIsOfferPausing(false);
                        }
                      }}
                      disabled={nftsWithoutOffers.length === 0 || isCreatingOffers || !offerPrice}
                      className="w-full h-12 md:h-14 text-base md:text-lg"
                    >
                      {offerStopped ? (
                        'Stopped'
                      ) : isCreatingOffers ? (
                        <><Loader2 className="w-5 h-5 animate-spin mr-2" />{offerProgress}/{mintedNfts.length} Creating...</>
                      ) : nftsWithoutOffers.length === 0 ? (
                        mintedNfts.length === 0 ? 'No NFTs to offer' : 'All offers created'
                      ) : (
                        filteredOffers.length > 0 ? 'Continue Creating' : 'Start Creating'
                      )}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full gap-2 h-12 md:h-14 text-base md:text-lg"
                      onClick={() => {
                        offerPauseRef.current = true;
                        setIsOfferPausing(true);
                      }}
                      disabled={!isCreatingOffers || isOfferPausing}
                    >
                      {isOfferPausing ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />Pausing...</>
                      ) : (
                        <><Pause className="w-5 h-5" />Pause</>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-6 md:p-12">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg md:text-2xl font-semibold">Offers History ({filteredOffers.length})</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={filteredOffers.length === 0}
                        onClick={() => setShowDeleteModal(true)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={filteredOffers.length === 0}
                        onClick={() => {
                          setDownloadFrom(1);
                          setDownloadTo(filteredOffers.length);
                          setShowDownloadModal(true);
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {filteredOffers.length === 0 ? (
                    <p className="text-muted-foreground">No offers created yet</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredOffers
                        .sort((a, b) => {
                          if (a.editionNumber > 0 && b.editionNumber > 0) return a.editionNumber - b.editionNumber;
                          if (a.editionNumber > 0) return -1;
                          if (b.editionNumber > 0) return 1;
                          return (a.name || '').localeCompare(b.name || '');
                        })
                        .map((item, index) => (
                        <div
                          key={`offer-${item.launcherId}-${index}-${item.offer.slice(-8)}`}
                          className="flex items-center justify-between p-3 md:p-4 rounded-lg bg-secondary/50 border border-border"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm md:text-base font-medium text-primary shrink-0">
                              #{item.editionNumber}
                            </span>
                            <span className="text-sm md:text-base font-mono truncate">
                              {item.offer.slice(0, 16)}...{item.offer.slice(-8)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 ml-auto"
                            onClick={() => navigator.clipboard.writeText(item.offer)}
                          >
                            Copy
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </main>

        <footer className="border-t border-border py-6 md:py-8">
         <p className="text-center text-xs sm:text-sm text-muted-foreground">
            Made with 💚 by{' '}
           <a
             href="https://x.com/xkirteria"
             target="_blank"
             rel="noopener noreferrer"
             className="text-green-500"
            >
             Kirteria
          </a>
        </p>
      </footer>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Offers?</h3>
            <p className="text-muted-foreground mb-6">Are you sure you want to delete offer history for this collection? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const remaining = createdOffers.filter(o => o.collectionId !== selectedCollection);
                  setCreatedOffers(remaining);
                  setShowDeleteModal(false);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDownloadModal && (() => {
        const sortedOffers = [...filteredOffers].sort((a, b) => {
          if (a.editionNumber > 0 && b.editionNumber > 0) return a.editionNumber - b.editionNumber;
          if (a.editionNumber > 0) return -1;
          if (b.editionNumber > 0) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Download Offers</h3>
              <p className="text-muted-foreground mb-4">Select range to download</p>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">From</label>
                  <select
                    value={downloadFrom}
                    onChange={(e) => setDownloadFrom(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
                  >
                    {sortedOffers.map((item, idx) => (
                      <option key={`from-${idx}`} value={idx + 1}>
                        {item.editionNumber > 0 ? `#${item.editionNumber}` : item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-muted-foreground pt-5">to</span>
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">To</label>
                  <select
                    value={downloadTo}
                    onChange={(e) => setDownloadTo(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
                  >
                    {sortedOffers.map((item, idx) => (
                      <option key={`to-${idx}`} value={idx + 1}>
                        {item.editionNumber > 0 ? `#${item.editionNumber}` : item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowDownloadModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    const JSZip = (await import('jszip')).default;
                    const zip = new JSZip();
                    const start = Math.max(0, downloadFrom - 1);
                    const end = Math.min(sortedOffers.length, downloadTo);
                    sortedOffers.slice(start, end).forEach((item) => {
                      const fileName = item.editionNumber > 0 
                        ? `${item.editionNumber}.offer` 
                        : `${item.name.replace(/\s+/g, '-')}.offer`;
                      zip.file(fileName, item.offer);
                    });
                    const blob = await zip.generateAsync({ type: 'blob' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `offers-${downloadFrom}-to-${downloadTo}.zip`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setShowDownloadModal(false);
                  }}
                >
                  Download
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
