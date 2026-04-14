import { MaterialIcons } from '@expo/vector-icons';
import { Buffer } from 'buffer';
import algosdk from 'algosdk';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { AppChrome, CHROME_SIDEBAR_WIDTH, CHROME_TOP_HEIGHT } from '../../src/components/AppChrome';
import { WalletQrModal } from '../../src/components/WalletQrModal';
import { fetchAccountAssets, mintTestAsset } from '../../src/services/api';
import { loadWalletSecretKey } from '../../src/storage/walletSecretStorage';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';
import type { AccountAsset, GhostTransaction } from '../../src/types/transaction';
import { shortAddress } from '../../src/utils/format';

const ALGONODE_MAINNET = 'https://mainnet-api.algonode.cloud';
const ALGONODE_TESTNET = 'https://testnet-api.algonode.cloud';

function getAlgodServer(network: 'testnet' | 'mainnet' | 'unknown'): string {
  return network === 'mainnet' ? ALGONODE_MAINNET : ALGONODE_TESTNET;
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function estimateAssetUsd(asset: AccountAsset): number | null {
  if (asset.isAlgo) {
    return asset.amount * 1.5;
  }

  const symbol = asset.unitName.toUpperCase();
  if (symbol === 'USDC' || symbol === 'USD') {
    return asset.amount;
  }

  return null;
}

function activityUi(tx: GhostTransaction, walletAddress: string) {
  if (tx.status === 'confirmed') {
    return {
      title: 'Payment Confirmed',
      icon: 'check',
      iconColor: '#90D5B7',
      amountColor: tx.sender === walletAddress ? '#FFB4AB' : '#90D5B7'
    };
  }

  if (tx.status === 'pending' || tx.status === 'syncing') {
    return {
      title: 'Transaction Queued',
      icon: 'schedule',
      iconColor: '#00F5FF',
      amountColor: '#00F5FF'
    };
  }

  return {
    title: 'Transaction Failed',
    icon: 'close',
    iconColor: '#FFB4AB',
    amountColor: '#FFB4AB'
  };
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [qrVisible, setQrVisible] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [accountAssets, setAccountAssets] = useState<AccountAsset[]>([]);
  const walletAddress = useWalletStore((state) => state.walletAddress);
  const algorandNetwork = useWalletStore((state) => state.algorandNetwork);
  const isConnected = useWalletStore((state) => state.isConnected);
  const demoMode = useWalletStore((state) => state.demoMode);
  const transactions = useWalletStore((state) => state.transactions);
  const syncPendingTransactions = useWalletStore((state) => state.syncPendingTransactions);

  const withSidebar = Platform.OS === 'web' && width >= 1024;
  const isWide = width >= 1080;
  const effectiveOnline = useMemo(() => isConnected && !demoMode.simulateOffline, [demoMode.simulateOffline, isConnected]);
  const recentTransactions = useMemo(() => transactions.slice(0, 3), [transactions]);
  const algoBalance = useMemo(() => accountAssets.find((asset) => asset.isAlgo)?.amount ?? 0, [accountAssets]);
  const estimatedUsdTotal = useMemo(
    () => accountAssets.reduce((sum, asset) => sum + (estimateAssetUsd(asset) ?? 0), 0),
    [accountAssets]
  );

  const loadAssets = useCallback(async () => {
    if (!walletAddress) {
      setAccountAssets([]);
      return;
    }

    setAssetsLoading(true);
    try {
      const assets = await fetchAccountAssets(walletAddress);
      setAccountAssets(assets);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Asset refresh failed',
        text2: error instanceof Error ? error.message : 'Unable to fetch assets for this wallet'
      });
    } finally {
      setAssetsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const handleMint = useCallback(async () => {
    setMinting(true);
    try {
      const minted = await mintTestAsset({
        assetName: 'GhostPay Token',
        unitName: 'GHOST',
        total: 1_000_000,
        decimals: 2,
        assetUrl: 'https://ghostpay.app/token',
        senderAddress: walletAddress,
        signedTxnBase64: await (async () => {
          if (!walletAddress) {
            throw new Error('Connect a wallet before minting');
          }

          const secretKey = await loadWalletSecretKey(walletAddress);
          if (!secretKey) {
            throw new Error('Local wallet key not found. Re-import or create wallet in Settings');
          }

          const localAddress = algosdk.encodeAddress(secretKey.slice(32));
          if (localAddress !== walletAddress) {
            throw new Error('Connected wallet does not match local signing key');
          }

          const algod = new algosdk.Algodv2('', getAlgodServer(algorandNetwork), '');
          const params = await algod.getTransactionParams().do();
          const networkFeeMicro = typeof params.fee === 'bigint' ? Number(params.fee) : Number(params.fee ?? 1_000);
          const minFeeMicro = typeof params.minFee === 'bigint' ? Number(params.minFee) : Number(params.minFee ?? 1_000);
          const txFeeMicro = Math.max(networkFeeMicro, minFeeMicro, 1_000);

          const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
            sender: walletAddress,
            total: BigInt(1_000_000),
            decimals: 2,
            defaultFrozen: false,
            unitName: 'GHOST',
            assetName: 'GhostPay Token',
            assetURL: 'https://ghostpay.app/token',
            manager: walletAddress,
            reserve: walletAddress,
            freeze: walletAddress,
            clawback: walletAddress,
            suggestedParams: {
              ...params,
              fee: BigInt(txFeeMicro),
              flatFee: true
            }
          });

          const signed = createTxn.signTxn(secretKey);
          return Buffer.from(signed).toString('base64');
        })()
      });

      Toast.show({
        type: 'success',
        text1: minted.assetId ? `Minted asset #${minted.assetId}` : 'Mint submitted',
        text2: minted.assetId
          ? (
              minted.creator === walletAddress
                ? 'Minted into your connected wallet'
                : `Minted into wallet ${shortAddress(minted.creator, 6, 6)}`
            )
          : `Transaction submitted: ${shortAddress(minted.txId, 8, 6)}. Asset may appear after a short delay.`
      });

      await loadAssets();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Mint failed',
        text2: error instanceof Error ? error.message : 'Unable to mint test asset'
      });
    } finally {
      setMinting(false);
    }
  }, [algorandNetwork, loadAssets, walletAddress]);

  return (
    <LinearGradient colors={['#111417', '#121a21', '#111417']} style={styles.screen}>
      <AppChrome activeSection='dashboard' />

      <ScrollView contentContainerStyle={[styles.content, withSidebar && styles.contentWithSidebar]}>
        <Animated.View entering={FadeInDown.duration(450).springify()}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.pageTitle}>Overview</Text>
              <Text style={styles.pageSub}>Welcome back. Your vault is currently <Text style={styles.syncedText}>Synced</Text>.</Text>
            </View>

            <View style={styles.feeCard}>
              <MaterialIcons name='bolt' size={18} color='#E9FEFF' />
              <View>
                <Text style={styles.feeLabel}>Network Fee</Text>
                <Text style={styles.feeValue}>0.0001 ALGO</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(90).duration(520).springify()}>
          <View style={[styles.bentoRow, !isWide && styles.bentoRowStack]}>
            <LinearGradient colors={['rgba(233,254,255,0.08)', 'rgba(0,220,229,0.03)']} style={[styles.heroCard, !isWide && styles.heroCardStack]}>
              <View style={styles.heroGlow} />
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroLabel}>Wallet Balance</Text>
                  <Text style={styles.heroValue}>
                    {showBalance ? `${algoBalance.toLocaleString('en-US', { maximumFractionDigits: 6 })} ALGO` : '••••••'}
                  </Text>
                  <Text style={styles.heroDelta}>{showBalance ? `Estimated ${formatUsd(estimatedUsdTotal)}` : 'Estimated ••••••'}</Text>
                </View>
                <Pressable style={styles.heroEyeWrap} onPress={() => setShowBalance((prev) => !prev)}>
                  <MaterialIcons name={showBalance ? 'visibility' : 'visibility-off'} size={18} color='#E9FEFF' />
                </Pressable>
              </View>

              <View style={styles.chainRow}>
                <View style={styles.chainPillPrimary}>
                  <View style={styles.chainDotPrimary} />
                  <Text style={styles.chainPillPrimaryText}>Algorand</Text>
                </View>
                <View style={styles.chainPill}>
                  <View style={styles.chainDotSecondary} />
                  <Text style={styles.chainPillText}>USDC</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={[styles.actionsColumn, !isWide && styles.actionsColumnStack]}>
              <Pressable style={styles.actionCard} onPress={() => router.replace('/(tabs)/send')}>
                <View style={styles.actionIconWrapPrimary}>
                  <MaterialIcons name='send' size={20} color='#E9FEFF' />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Send</Text>
                  <Text style={styles.actionSub}>Instant transfer</Text>
                </View>
                <MaterialIcons name='arrow-forward-ios' size={16} color='#B9CACA' />
              </Pressable>

              <Pressable style={styles.actionCard} onPress={() => setQrVisible(true)}>
                <View style={styles.actionIconWrapSecondary}>
                  <MaterialIcons name='call-received' size={20} color='#90D5B7' />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Receive</Text>
                  <Text style={styles.actionSub}>Show QR code</Text>
                </View>
                <MaterialIcons name='arrow-forward-ios' size={16} color='#B9CACA' />
              </Pressable>

              <Pressable style={styles.actionCard} onPress={() => void syncPendingTransactions()}>
                <View style={styles.actionIconWrapPrimary}>
                  <MaterialIcons name='sync' size={20} color='#E9FEFF' />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Sync</Text>
                  <Text style={styles.actionSub}>Refresh ledger</Text>
                </View>
                <MaterialIcons name='arrow-forward-ios' size={16} color='#B9CACA' />
              </Pressable>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(560).springify()}>
          <View style={[styles.lowerRow, !isWide && styles.lowerRowStack]}>
            <View style={[styles.assetSection, !isWide && styles.assetSectionStack]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active Assets</Text>
                <View style={styles.sectionActions}>
                  <Pressable style={styles.sectionButton} onPress={() => void loadAssets()} disabled={assetsLoading}>
                    <Text style={styles.sectionButtonText}>{assetsLoading ? 'Refreshing...' : 'Refresh'}</Text>
                  </Pressable>
                  <Pressable style={[styles.sectionButton, minting && styles.sectionButtonDisabled]} onPress={() => void handleMint()} disabled={minting}>
                    <Text style={styles.sectionButtonText}>{minting ? 'Minting...' : 'Mint'}</Text>
                  </Pressable>
                </View>
              </View>

              {accountAssets.length === 0 ? (
                <View style={styles.assetCard}>
                  <Text style={styles.noActivity}>No assets found for this wallet yet.</Text>
                </View>
              ) : (
                accountAssets.map((asset) => {
                  const estimatedUsd = estimateAssetUsd(asset);
                  const unit = asset.unitName || `ASA-${asset.assetId}`;
                  const icon = asset.isAlgo ? 'A' : (unit[0] || '$').toUpperCase();

                  return (
                    <View key={`${asset.assetId}-${unit}`} style={styles.assetCard}>
                      <View style={styles.assetLeft}>
                        <View style={styles.assetIconWrap}>
                          <Text style={asset.isAlgo ? styles.assetIconA : styles.assetIconU}>{icon}</Text>
                        </View>
                        <View>
                          <Text style={styles.assetName}>{asset.name}</Text>
                          <Text style={styles.assetAmount}>{asset.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {unit}</Text>
                        </View>
                      </View>
                      <View style={styles.assetRight}>
                        <Text style={styles.assetUsd}>{estimatedUsd === null ? 'N/A' : formatUsd(estimatedUsd)}</Text>
                        <Text style={styles.assetStable}>{asset.isAlgo ? 'Layer-1' : `ID ${asset.assetId}`}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.activitySection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <View style={styles.filterWrap}>
                  <Text style={styles.filterPillActive}>All</Text>
                  <Text style={styles.filterPill}>Pending</Text>
                </View>
              </View>

              <View style={styles.activityList}>
                {recentTransactions.length === 0 ? (
                  <Text style={styles.noActivity}>No recent activity yet.</Text>
                ) : (
                  recentTransactions.map((item) => {
                    const meta = activityUi(item, walletAddress);
                    const amountLabel = `${item.sender === walletAddress ? '-' : '+'} ${item.amount.toFixed(3)} ALGO`;

                    return (
                      <View key={item.id} style={styles.activityItemRow}>
                        <View style={styles.timelineCol}>
                          <View style={[styles.timelineIcon, { borderColor: `${meta.iconColor}55` }]}>
                            <MaterialIcons name={meta.icon as keyof typeof MaterialIcons.glyphMap} size={15} color={meta.iconColor} />
                          </View>
                          <View style={styles.timelineLine} />
                        </View>

                        <View style={styles.activityCard}>
                          <View style={styles.activityTopLine}>
                            <View>
                              <Text style={styles.activityTitle}>{meta.title}</Text>
                              <Text style={styles.activityTo}>To: {shortAddress(item.receiver, 4, 4)}</Text>
                            </View>
                            <Text style={[styles.activityAmount, { color: meta.amountColor }]}>{amountLabel}</Text>
                          </View>

                          <View style={styles.activityBottomLine}>
                            <Text style={styles.activityTime}>{new Date(item.timestamp).toLocaleString()}</Text>
                            <Text style={styles.activityBadge}>{item.status.toUpperCase()}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={styles.networkFooter}>
          <Text style={styles.networkFooterText}>Network: {algorandNetwork.toUpperCase()}</Text>
          <Text style={[styles.networkStatus, effectiveOnline ? styles.online : styles.offline]}>
            {effectiveOnline ? 'ONLINE: auto-sync armed' : 'OFFLINE: queue mode active'}
          </Text>
        </View>
      </ScrollView>

      <WalletQrModal visible={qrVisible} walletAddress={walletAddress} onClose={() => setQrVisible(false)} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    paddingTop: CHROME_TOP_HEIGHT + 16,
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 24
  },
  contentWithSidebar: {
    paddingLeft: CHROME_SIDEBAR_WIDTH + 24
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    flexWrap: 'wrap'
  },
  pageTitle: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 40,
    letterSpacing: -0.5
  },
  pageSub: {
    marginTop: 6,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 16
  },
  syncedText: {
    color: '#90D5B7',
    fontFamily: 'Rajdhani_700Bold'
  },
  feeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#191C1F',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.3)'
  },
  feeLabel: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  feeValue: {
    color: '#E1E2E7',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 14
  },
  bentoRowStack: {
    flexDirection: 'column'
  },
  heroCard: {
    flex: 2,
    borderRadius: 20,
    padding: 22,
    minHeight: 300,
    borderWidth: 1,
    borderColor: 'rgba(233,254,255,0.1)',
    overflow: 'hidden'
  },
  heroCardStack: {
    minHeight: 260
  },
  heroGlow: {
    position: 'absolute',
    width: 320,
    height: 180,
    bottom: -20,
    left: -30,
    backgroundColor: 'rgba(0,245,255,0.08)',
    borderRadius: 200
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  heroLabel: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase'
  },
  heroValue: {
    marginTop: 6,
    color: '#FFFFFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 44,
    letterSpacing: -0.7
  },
  heroDelta: {
    marginTop: 4,
    color: '#90D5B7',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 14
  },
  heroEyeWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  chainRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  chainPillPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(50,53,57,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)'
  },
  chainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(50,53,57,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)'
  },
  chainDotPrimary: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: '#00F5FF'
  },
  chainDotSecondary: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: '#90D5B7'
  },
  chainDotMuted: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: '#C5C4DE'
  },
  chainPillPrimaryText: {
    color: '#00F5FF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12
  },
  chainPillText: {
    color: '#E1E2E7',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12
  },
  actionsColumn: {
    flex: 1,
    gap: 10
  },
  actionsColumnStack: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#191C1F',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.3)',
    minHeight: 84,
    flexGrow: 1
  },
  actionIconWrapPrimary: {
    width: 42,
    height: 42,
    borderRadius: 99,
    backgroundColor: 'rgba(0,245,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionIconWrapSecondary: {
    width: 42,
    height: 42,
    borderRadius: 99,
    backgroundColor: 'rgba(144,213,183,0.13)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionContent: {
    flex: 1
  },
  actionTitle: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 16
  },
  actionSub: {
    marginTop: 2,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 12
  },
  lowerRow: {
    flexDirection: 'row',
    gap: 16
  },
  lowerRowStack: {
    flexDirection: 'column'
  },
  assetSection: {
    flex: 1.05,
    gap: 10
  },
  assetSectionStack: {
    flex: 1
  },
  activitySection: {
    flex: 1.35,
    gap: 10
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 22
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 8
  },
  sectionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,245,255,0.08)'
  },
  sectionButtonDisabled: {
    opacity: 0.6
  },
  sectionButtonText: {
    color: '#00F5FF',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase'
  },
  sectionAction: {
    color: '#00F5FF',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase'
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#191C1F',
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.25)'
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  assetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#282A2E',
    alignItems: 'center',
    justifyContent: 'center'
  },
  assetIconA: {
    color: '#00F5FF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 20
  },
  assetIconU: {
    color: '#90D5B7',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 20
  },
  assetName: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 15
  },
  assetAmount: {
    marginTop: 1,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 12
  },
  assetRight: {
    alignItems: 'flex-end'
  },
  assetUsd: {
    color: '#E1E2E7',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14
  },
  assetDelta: {
    color: '#90D5B7',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11
  },
  assetStable: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11
  },
  filterWrap: {
    flexDirection: 'row',
    gap: 6
  },
  filterPillActive: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#323539',
    color: '#E1E2E7',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: 'uppercase'
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#1D2023',
    color: '#B9CACA',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: 'uppercase'
  },
  activityList: {
    gap: 8
  },
  noActivity: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 14
  },
  activityItemRow: {
    flexDirection: 'row',
    gap: 10
  },
  timelineCol: {
    width: 26,
    alignItems: 'center'
  },
  timelineIcon: {
    width: 24,
    height: 24,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(50,53,57,0.4)',
    borderWidth: 1
  },
  timelineLine: {
    marginTop: 2,
    width: 1,
    flex: 1,
    minHeight: 46,
    backgroundColor: 'rgba(58,73,74,0.4)'
  },
  activityCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#1D2023',
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.25)',
    marginBottom: 8
  },
  activityTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  activityTitle: {
    color: '#E1E2E7',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14
  },
  activityTo: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 12
  },
  activityAmount: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 13
  },
  activityBottomLine: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  activityTime: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 11
  },
  activityBadge: {
    color: '#90D5B7',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    backgroundColor: 'rgba(144,213,183,0.1)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  networkFooter: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(17,20,23,0.6)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8
  },
  networkFooterText: {
    color: '#E1E2E7',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12,
    letterSpacing: 0.5
  },
  networkStatus: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  online: {
    color: '#90D5B7'
  },
  offline: {
    color: colors.warning
  }
});
