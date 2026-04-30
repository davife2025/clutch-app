import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { ArrowRight } from 'lucide-react-native'
import { theme } from '../../src/lib/theme'
import { api } from '../../src/lib/api'

export default function RegisterScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    setError('')
    setLoading(true)
    const { data, error } = await api.register(email, password)
    setLoading(false)
    if (error || !data) {
      setError(error?.message ?? 'Registration failed')
      return
    }
    await api.setToken(data.token)
    await api.setPocketId(data.pocketId)
    router.replace('/(tabs)')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.ink[900] }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, padding: 24, justifyContent: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: theme.colors.gold.DEFAULT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: 'Fraunces', fontSize: 20, fontWeight: '700', color: theme.colors.ink[900] }}>
              C
            </Text>
          </View>
          <Text style={{ fontFamily: 'Fraunces', fontSize: 22, color: theme.colors.cream, letterSpacing: -0.5 }}>
            Clutch
          </Text>
        </View>

        <Text
          style={{
            fontFamily: 'Fraunces',
            fontSize: 38,
            fontWeight: '300',
            color: theme.colors.cream,
            letterSpacing: -1.5,
            marginBottom: 8,
          }}
        >
          Open a pocket
        </Text>
        <Text style={{ fontSize: 16, color: theme.colors.ink[200], marginBottom: 36 }}>
          Your wallets, unified. One minute to set up.
        </Text>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: theme.colors.ink[200], marginBottom: 8 }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: theme.colors.ink[800],
              borderColor: theme.colors.ink[600],
              borderWidth: 1,
              borderRadius: 12,
              padding: 14,
              color: theme.colors.cream,
              fontSize: 16,
            }}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.ink[400]}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: theme.colors.ink[200], marginBottom: 8 }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: theme.colors.ink[800],
              borderColor: theme.colors.ink[600],
              borderWidth: 1,
              borderRadius: 12,
              padding: 14,
              color: theme.colors.cream,
              fontSize: 16,
            }}
            placeholder="At least 8 characters"
            placeholderTextColor={theme.colors.ink[400]}
          />
        </View>

        {error ? (
          <View
            style={{
              padding: 12,
              backgroundColor: 'rgba(168, 91, 59, 0.1)',
              borderColor: 'rgba(168, 91, 59, 0.3)',
              borderWidth: 1,
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: theme.colors.rust, fontSize: 14 }}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleRegister}
          disabled={loading}
          style={{
            backgroundColor: theme.colors.gold.DEFAULT,
            padding: 16,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.ink[900]} />
          ) : (
            <>
              <Text style={{ color: theme.colors.ink[900], fontSize: 16, fontWeight: '600' }}>
                Create pocket
              </Text>
              <ArrowRight color={theme.colors.ink[900]} size={16} />
            </>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 28, gap: 4 }}>
          <Text style={{ color: theme.colors.ink[300], fontSize: 14 }}>Already have a pocket?</Text>
          <Link href="/auth/login">
            <Text style={{ color: theme.colors.gold.DEFAULT, fontSize: 14 }}>Sign in</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
