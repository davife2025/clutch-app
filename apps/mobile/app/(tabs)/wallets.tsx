import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Plus, X, Star, Wallet as WalletIcon } from 'lucide-react-native'
import { theme } from '../../src/lib/theme'
import { api } from '../../src/lib/api'
import { truncateAddress, chainLabel } from '../../src/lib/format'

const SOLANA_CHAIN = { value: 'solana', label: 'Solana (signing-capable)' }
const EVM_CHAINS = [
  { value: 'ethereum', label: 'Ethereum (read-only)' },
  { value: 'base', label: 'Base (read-only)' },
  { value: 'polygon', label: 'Polygon (read-only)' },
  { value: 'arbitrum', label: 'Arbitrum (read-only)' },
  { value: 'optimism', label: 'Optimism (read-only)' },
]

export default function WalletsScreen() {
  const [wallets, setWallets] = useState<any[]>([])
  const [pocketId, setPocketId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const id = await api.getPocketId()
    if (!id) return
    setPocketId(id)
    const { data } = await api.getPocketSummary(id)
    if (data) {
      setWallets([...data.solanaWallets, ...data.externalBalances])
    }
    setLoading(false)
  }

  async function handleRemove(walletId: string) {
    if (!pocketId) return
    Alert.alert('Remove wallet?', 'This wallet will be removed from your pocket.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await api.removeWallet(pocketId, walletId)
          load()
        },
      },
    ])
  }

  async function handleSetDefault(walletId: string) {
    if (!pocketId) return
    await api.setDefaultWallet(pocketId, walletId)
    load()
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.ink[900] }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <View>
            <Text
              style={{ fontSize: 11, letterSpacing: 2, color: theme.colors.ink[300], textTransform: 'uppercase', marginBottom: 6 }}
            >
              Wallets
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
              Your wallets
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAdd(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: theme.colors.gold.DEFAULT,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Plus color={theme.colors.ink[900]} size={16} />
            <Text style={{ color: theme.colors.ink[900], fontWeight: '600', fontSize: 13 }}>Add</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.gold.DEFAULT} />
        ) : wallets.length === 0 ? (
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
            <Text style={{ fontFamily: 'Fraunces', fontSize: 22, color: theme.colors.cream, marginTop: 16, marginBottom: 8 }}>
              No wallets yet
            </Text>
            <Text style={{ fontSize: 14, color: theme.colors.ink[300], textAlign: 'center' }}>
              Add your first wallet to start using the pocket.
            </Text>
          </View>
        ) : (
          wallets.map((w) => (
            <View
              key={w.walletId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                backgroundColor: theme.colors.ink[800],
                borderColor: theme.colors.ink[700],
                borderWidth: 1,
                borderRadius: 14,
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: w.chain === 'solana' ? 'rgba(201, 169, 97, 0.1)' : theme.colors.ink[700],
                    borderColor: w.chain === 'solana' ? 'rgba(201, 169, 97, 0.2)' : theme.colors.ink[600],
                    borderWidth: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <WalletIcon
                    color={w.chain === 'solana' ? theme.colors.gold.DEFAULT : theme.colors.ink[300]}
                    size={18}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: theme.colors.cream, fontSize: 14, fontWeight: '500' }}>
                      {w.label ?? 'Wallet'}
                    </Text>
                    {w.isDefault ? (
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          backgroundColor: 'rgba(201, 169, 97, 0.1)',
                          borderColor: 'rgba(201, 169, 97, 0.2)',
                          borderWidth: 1,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ fontSize: 8, letterSpacing: 1, color: theme.colors.gold.DEFAULT, textTransform: 'uppercase' }}>
                          Default
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 11, color: theme.colors.ink[300], marginTop: 2 }}>
                    {chainLabel(w.chain)} · {truncateAddress(w.address)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {!w.isDefault ? (
                  <TouchableOpacity onPress={() => handleSetDefault(w.walletId)} style={{ padding: 8 }}>
                    <Star color={theme.colors.ink[300]} size={16} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => handleRemove(w.walletId)} style={{ padding: 8 }}>
                  <X color={theme.colors.ink[300]} size={16} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <AddWalletModal
        visible={showAdd}
        pocketId={pocketId}
        onClose={() => {
          setShowAdd(false)
          load()
        }}
      />
    </SafeAreaView>
  )
}

function AddWalletModal({
  visible,
  pocketId,
  onClose,
}: {
  visible: boolean
  pocketId: string | null
  onClose: () => void
}) {
  const [address, setAddress] = useState('')
  const [chain, setChain] = useState('solana')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!pocketId) return
    setError('')
    setLoading(true)
    const { error } = await api.addWallet(pocketId, { address, chain, label: label || undefined })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setAddress('')
    setLabel('')
    setChain('solana')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'rgba(11, 10, 7, 0.85)', justifyContent: 'flex-end' }}
      >
        <View
          style={{
            backgroundColor: theme.colors.ink[800],
            borderTopColor: theme.colors.ink[600],
            borderTopWidth: 1,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 40,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontFamily: 'Fraunces', fontSize: 22, color: theme.colors.cream }}>
              Add wallet
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X color={theme.colors.ink[300]} size={24} />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, color: theme.colors.ink[200], marginBottom: 8 }}>Chain</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {[SOLANA_CHAIN, ...EVM_CHAINS].map((c) => (
              <TouchableOpacity
                key={c.value}
                onPress={() => setChain(c.value)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginRight: 6,
                  borderRadius: 999,
                  backgroundColor: chain === c.value ? theme.colors.gold.DEFAULT : theme.colors.ink[700],
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: chain === c.value ? theme.colors.ink[900] : theme.colors.ink[200],
                  }}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={{ fontSize: 13, color: theme.colors.ink[200], marginBottom: 8 }}>Address</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={chain === 'solana' ? 'So11111...' : '0x...'}
            placeholderTextColor={theme.colors.ink[400]}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: theme.colors.ink[900],
              borderColor: theme.colors.ink[600],
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              color: theme.colors.cream,
              fontSize: 14,
              fontFamily: 'JetBrainsMono',
              marginBottom: 14,
            }}
          />

          <Text style={{ fontSize: 13, color: theme.colors.ink[200], marginBottom: 8 }}>
            Label <Text style={{ color: theme.colors.ink[400] }}>(optional)</Text>
          </Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Phantom main"
            placeholderTextColor={theme.colors.ink[400]}
            style={{
              backgroundColor: theme.colors.ink[900],
              borderColor: theme.colors.ink[600],
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              color: theme.colors.cream,
              fontSize: 14,
              marginBottom: 14,
            }}
          />

          {error ? (
            <View
              style={{
                padding: 10,
                backgroundColor: 'rgba(168, 91, 59, 0.1)',
                borderColor: 'rgba(168, 91, 59, 0.3)',
                borderWidth: 1,
                borderRadius: 10,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: theme.colors.rust, fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !address}
            style={{
              backgroundColor: theme.colors.gold.DEFAULT,
              padding: 14,
              borderRadius: 12,
              alignItems: 'center',
              opacity: loading || !address ? 0.5 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.ink[900]} />
            ) : (
              <Text style={{ color: theme.colors.ink[900], fontSize: 15, fontWeight: '600' }}>
                Add wallet
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
