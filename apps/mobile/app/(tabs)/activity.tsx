import { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, Linking, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowDownLeft, ArrowUpRight, Activity as ActivityIcon, ExternalLink } from 'lucide-react-native'
import { theme } from '../../src/lib/theme'
import { api } from '../../src/lib/api'
import { truncateAddress, formatRelativeTime } from '../../src/lib/format'

export default function ActivityScreen() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const pocketId = await api.getPocketId()
    if (!pocketId) return
    const { data } = await api.getTransactions(pocketId, 100)
    setTransactions(data?.transactions ?? [])
    setLoading(false)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.ink[900] }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{ fontSize: 11, letterSpacing: 2, color: theme.colors.ink[300], textTransform: 'uppercase', marginBottom: 6 }}
          >
            Activity
          </Text>
          <Text
            style={{
              fontFamily: 'Fraunces',
              fontSize: 32,
              fontWeight: '300',
              color: theme.colors.cream,
              letterSpacing: -1,
            }}
          >
            History
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.gold.DEFAULT} />
        ) : transactions.length === 0 ? (
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
            <ActivityIcon color={theme.colors.ink[400]} size={40} />
            <Text style={{ fontFamily: 'Fraunces', fontSize: 22, color: theme.colors.cream, marginTop: 16, marginBottom: 6 }}>
              No activity yet
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.ink[300], textAlign: 'center' }}>
              Deposits, withdrawals, and payments will appear here.
            </Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <TouchableOpacity
              key={tx.id}
              onPress={() => tx.txHash && Linking.openURL(`https://solscan.io/tx/${tx.txHash}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                backgroundColor: theme.colors.ink[800],
                borderColor: theme.colors.ink[700],
                borderWidth: 1,
                borderRadius: 14,
                marginBottom: 8,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor:
                    tx.type === 'deposit' ? 'rgba(92, 116, 86, 0.1)' : 'rgba(201, 169, 97, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {tx.type === 'deposit' ? (
                  <ArrowDownLeft color={theme.colors.moss} size={16} />
                ) : (
                  <ArrowUpRight color={theme.colors.gold.DEFAULT} size={16} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: theme.colors.cream, fontSize: 14, fontWeight: '500', textTransform: 'capitalize' }}>
                    {tx.type}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 4,
                      backgroundColor:
                        tx.status === 'confirmed'
                          ? 'rgba(92, 116, 86, 0.1)'
                          : tx.status === 'pending'
                            ? 'rgba(201, 169, 97, 0.1)'
                            : 'rgba(168, 91, 59, 0.1)',
                      borderColor:
                        tx.status === 'confirmed'
                          ? 'rgba(92, 116, 86, 0.2)'
                          : tx.status === 'pending'
                            ? 'rgba(201, 169, 97, 0.2)'
                            : 'rgba(168, 91, 59, 0.2)',
                      borderWidth: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        letterSpacing: 1,
                        color:
                          tx.status === 'confirmed'
                            ? theme.colors.moss
                            : tx.status === 'pending'
                              ? theme.colors.gold.DEFAULT
                              : theme.colors.rust,
                        textTransform: 'uppercase',
                      }}
                    >
                      {tx.status}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: theme.colors.ink[300], marginTop: 2, fontFamily: 'JetBrainsMono' }}>
                  {truncateAddress(tx.toAddress)} · {formatRelativeTime(tx.createdAt)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: 'Fraunces', fontSize: 15, color: theme.colors.cream }}>
                  {(Number(tx.amount) / 1e6).toFixed(4)}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.ink[300], marginTop: 2 }}>{tx.token}</Text>
              </View>
              {tx.txHash ? <ExternalLink color={theme.colors.ink[400]} size={14} /> : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
