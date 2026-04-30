import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { View, ActivityIndicator } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { theme } from '../src/lib/theme'
import { api } from '../src/lib/api'

export default function RootLayout() {
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  const [fontsLoaded] = useFonts({
    Fraunces: 'https://fonts.gstatic.com/s/fraunces/v32/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk.woff2',
    Geist: 'https://fonts.gstatic.com/s/geist/v1/gyByhwUxId8gMEwYGFU.woff2',
  })

  useEffect(() => {
    api.init().then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready) return
    const inAuth = segments[0] === 'auth'
    if (!api.isAuthenticated() && !inAuth) {
      router.replace('/auth/login')
    }
  }, [ready, segments])

  if (!ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.ink[900], alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.gold.DEFAULT} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.ink[900] },
          animation: 'fade',
        }}
      />
    </GestureHandlerRootView>
  )
}
