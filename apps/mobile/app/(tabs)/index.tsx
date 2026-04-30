import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { Plus, Wallet as WalletIcon, RefreshCw } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { theme } from '../../src/lib/theme'
import { api } from '../../src/lib/api'
import { formatUsd, truncateAddress, chainLabel } from '../../src/lib/format'

export default function PocketScreen() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadSummary()
  }, [])

  async function loadSummary() {
    let pocketId = await api.getPocketId()
    if (!pocketId) {
      const { data } = await api.listPockets()
      if (data?.pockets[0]) {
        await api.setPocketId(data.pockets[0].id)
        pocketId = data.pockets[0].id
      }
    }
    if (pocketId) {
      const { data } = await api.getPocketSummary(pocketId)
      setSummary(data)
    }
    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Haptics.selectionAsync()
    if (summary) {
      await api.syncBalances(summary.pocketId)
      await new Promise((r) => setTimeout(r, 1500))
      await loadSummary()
    }
    setRefreshing(false)
  }, [summary])

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.ink[900], alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.gold.DEFAULT} />
      </SafeAreaView>
    )
  }

  if (!summary) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.ink[900], padding: 24 }}>
        <Text style={{ color: theme.colors.ink[200] }}>No pocket found.</Text>
      </SafeAreaView>
    )
  }

  const hasNoWallets = summary.solanaWallets.length === 0 && summary.externalBalances.length === 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.ink[900] }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.gold.DEFAULT}
          />
        }
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 11,
              letterSpacing: 2,
              color: theme.colors.ink[300],
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Pocket
          </Text>
          <Text
            style={{
              fontFamily: 'Fraunces',
              fontSize: 36,
              fontWeight: '300',
              color: theme.colors.cream,
              letterSpacing: -1.2,
            }}
          >
            {summary.name}
          </Text>
        </View>

        {/* Total balance card */}
        <View
          style={{
            backgroundColor: theme.colors.ink[800],
            borderColor: 'rgba(201, 169, 97, 0.15)',
            borderWidth: 1,
            borderRadius: 20,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              letterSpacing: 2,
              color: theme.colors.gold.DEFAULT,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Total balance
          </Text>
          <Text
            style={{
              fontFamily: 'Fraunces',
              fontSize: 48,
              fontWeight: '300',
              color: theme.colors.cream,
              letterSpacing: -2,
              marginBottom: 24,
            }}
          >
            {formatUsd(summary.totalUsd)}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Stat label="Solana" value={formatUsd(summary.solanaUsd)} accent />
            <Stat label="External" value={formatUsd(summary.externalUsd)} />
            <Stat label="SOL" value={parseFloat(summary.nativeBalanceSol).toFixed(2)} />
          </View>
        </View>

        {/* Empty state or wallet sections */}
        {hasNoWallets ? (
          <View
            style={{
              padding: 32,
              borderRadius: 16,
              borderColor: theme.colors.ink[600],
              borderWidth: 1,
              borderStyle: 'dashed',
              alignItems: 'center',
            }}
          >
            <WalletIcon color={theme.colors.ink[400]} size={40} />
            <Text
              style={{
                fontFamily: 'Fraunces',
                fontSize: 22,
                color: theme.colors.cream,
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              Your pocket is empty
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.ink[300],
                textAlign: 'center',
                marginBottom: 20,
                lineHeight: 20,
              }}
            >
              Add a Solana wallet to start. Phantom, Backpack, Solflare — all welcome.
            </Text>
            <Link href="/(tabs)/wallets" asChild>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: theme.colors.gold.DEFAULT,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
              >
                <Plus color={theme.colors.ink[900]} size={16} />
                <Text style={{ color: theme.colors.ink[900], fontWeight: '600', fontSize: 14 }}>
                  Add a wallet
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        ) : (
          <>
            {summary.solanaWallets.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <SectionHeader title="Solana wallets" subtitle="Signing-capable" />
                {summary.solanaWallets.map((w: any) => (
                  <WalletCard key={w.walletId} wallet={w} primary />
                ))}
              </View>
            )}

            {summary.externalBalances.length > 0 && (
              <View>
                <SectionHeader title="External balances" subtitle="Read-only" />
                {summary.externalBalances.map((w: any) => (
                  <WalletCard key={w.walletId} wallet={w} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        backgroundColor: theme.colors.ink[700],
        borderRadius: 10,
      }}
    >
      <Text style={{ fontSize: 10, letterSpacing: 1.5, color: theme.colors.ink[300], textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: 'Fraunces',
          fontSize: 16,
          color: accent ? theme.colors.gold.DEFAULT : theme.colors.cream,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
      <Text style={{ fontFamily: 'Fraunces', fontSize: 20, fontWeight: '500', color: theme.colors.cream }}>
        {title}
      </Text>
      <Text style={{ fontSize: 12, color: theme.colors.ink[300] }}>{subtitle}</Text>
    </View>
  )
}

function WalletCard({ wallet, primary }: { wallet: any; primary?: boolean }) {
  return (
    <View
      style={{
        padding: 16,
        backgroundColor: theme.colors.ink[800],
        borderColor: primary ? 'rgba(201, 169, 97, 0.2)' : theme.colors.ink[700],
        borderWidth: 1,
        borderRadius: 14,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontWeight: '500', color: theme.colors.cream, fontSize: 15 }}>
              {wallet.label}
            </Text>
            {wallet.isDefault ? (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  backgroundColor: 'rgba(201, 169, 97, 0.1)',
                  borderColor: 'rgba(201, 169, 97, 0.2)',
                  borderWidth: 1,
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 9, letterSpacing: 1, color: theme.colors.gold.DEFAULT, textTransform: 'uppercase' }}>
                  Default
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontSize: 11, color: theme.colors.ink[300], marginTop: 2 }}>
            {chainLabel(wallet.chain)} · {truncateAddress(wallet.address)}
          </Text>
        </View>
        <Text style={{ fontFamily: 'Fraunces', fontSize: 18, color: theme.colors.cream }}>
          {formatUsd(wallet.usdValue)}
        </Text>
      </View>

      <View style={{ borderTopColor: theme.colors.ink[700], borderTopWidth: 1, paddingTop: 10 }}>
        {wallet.tokens.length === 0 ? (
          <Text style={{ fontSize: 12, color: theme.colors.ink[400] }}>No balances</Text>
        ) : (
          wallet.tokens.slice(0, 3).map((t: any) => (
            <View
              key={t.token}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}
            >
              <Text style={{ fontSize: 13, color: theme.colors.ink[200] }}>{t.token}</Text>
              <Text style={{ fontSize: 13, color: theme.colors.ink[300] }}>
                {(Number(t.amount) / 10 ** t.decimals).toFixed(4)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            backgroundColor: wallet.canSign ? 'rgba(92, 116, 86, 0.1)' : theme.colors.ink[700],
            borderColor: wallet.canSign ? 'rgba(92, 116, 86, 0.2)' : theme.colors.ink[600],
            borderWidth: 1,
            borderRadius: 4,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 1,
              color: wallet.canSign ? theme.colors.moss : theme.colors.ink[300],
              textTransform: 'uppercase',
            }}
          >
            {wallet.canSign ? 'Can sign' : 'Read-only'}
          </Text>
        </View>
      </View>
    </View>
  )
}
