import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { LogOut } from 'lucide-react-native'
import { theme } from '../../src/lib/theme'
import { api } from '../../src/lib/api'

export default function SettingsScreen() {
  const router = useRouter()

  async function logout() {
    await api.clearToken()
    router.replace('/auth/login')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.ink[900] }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{ fontSize: 11, letterSpacing: 2, color: theme.colors.ink[300], textTransform: 'uppercase', marginBottom: 6 }}
          >
            Settings
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
            Account
          </Text>
        </View>

        <Section title="Pocket">
          Your pocket holds your wallets and a native SOL balance. Multiple pockets coming soon.
        </Section>

        <Section title="Security">
          Auth tokens stored in iOS Keychain / Android Keystore via expo-secure-store. Custodial
          keys are encrypted with AES-256-GCM in the vault. Biometric unlock (Face ID / Touch ID)
          coming next.
        </Section>

        <Section title="About Clutch">
          Clutch is Solana-native. EVM wallets are read-only external balances for portfolio
          completeness. v0.1.0 · Built on Solana.
        </Section>

        <TouchableOpacity
          onPress={logout}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 14,
            borderColor: 'rgba(168, 91, 59, 0.3)',
            borderWidth: 1,
            borderRadius: 12,
            marginTop: 12,
          }}
        >
          <LogOut color={theme.colors.rust} size={16} />
          <Text style={{ color: theme.colors.rust, fontSize: 14, fontWeight: '500' }}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View
      style={{
        padding: 16,
        backgroundColor: theme.colors.ink[800],
        borderColor: theme.colors.ink[700],
        borderWidth: 1,
        borderRadius: 14,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          fontFamily: 'Fraunces',
          fontSize: 17,
          color: theme.colors.cream,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      <Text style={{ fontSize: 13, color: theme.colors.ink[200], lineHeight: 19 }}>{children}</Text>
    </View>
  )
}
