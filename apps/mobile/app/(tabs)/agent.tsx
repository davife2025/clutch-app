import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Send, Sparkles, ArrowRight, X } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { theme } from '../../src/lib/theme'
import { api } from '../../src/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  "What's in my pocket?",
  'How much SOL do I have?',
  'Estimate fee for 1 USDC',
  'Which wallet pays cheapest?',
]

export default function AgentScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true })
  }, [messages])

  async function send(text: string) {
    const pocketId = await api.getPocketId()
    if (!pocketId) return

    Haptics.selectionAsync()
    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    let assistantText = ''
    setMessages([...newMessages, { role: 'assistant', content: '' }])

    try {
      for await (const chunk of api.chatStream(pocketId, newMessages)) {
        assistantText += chunk
        setMessages([...newMessages, { role: 'assistant', content: assistantText }])
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Error: ${(err as Error).message}` },
      ])
    } finally {
      setStreaming(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.ink[900] }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            padding: 20,
            paddingBottom: 12,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 2,
                color: theme.colors.ink[300],
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Agent
            </Text>
            <Text
              style={{
                fontFamily: 'Fraunces',
                fontSize: 28,
                fontWeight: '300',
                color: theme.colors.cream,
                letterSpacing: -1,
              }}
            >
              Talk to your pocket
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowPay(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: theme.colors.gold.DEFAULT,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Sparkles color={theme.colors.ink[900]} size={14} />
            <Text style={{ color: theme.colors.ink[900], fontSize: 12, fontWeight: '600' }}>Pay</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingTop: 8 }}
        >
          {messages.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: 'rgba(201, 169, 97, 0.1)',
                  borderColor: 'rgba(201, 169, 97, 0.2)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <Sparkles color={theme.colors.gold.DEFAULT} size={26} />
              </View>
              <Text
                style={{
                  fontFamily: 'Fraunces',
                  fontSize: 24,
                  color: theme.colors.cream,
                  marginBottom: 8,
                  textAlign: 'center',
                }}
              >
                Your Solana-native agent
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.ink[200],
                  textAlign: 'center',
                  lineHeight: 20,
                  marginBottom: 28,
                  paddingHorizontal: 20,
                }}
              >
                Ask anything about your pocket. The agent knows your balances, can estimate fees,
                and execute Solana payments.
              </Text>
              <View style={{ width: '100%', gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => send(s)}
                    style={{
                      padding: 14,
                      backgroundColor: theme.colors.ink[800],
                      borderColor: theme.colors.ink[700],
                      borderWidth: 1,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ color: theme.colors.ink[100], fontSize: 14 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            messages.map((m, i) => <Bubble key={i} message={m} streaming={streaming && i === messages.length - 1} />)
          )}
        </ScrollView>

        {/* Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            backgroundColor: theme.colors.ink[800],
            borderTopColor: theme.colors.ink[700],
            borderTopWidth: 1,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything..."
            placeholderTextColor={theme.colors.ink[400]}
            editable={!streaming}
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: theme.colors.ink[700],
              borderRadius: 12,
              color: theme.colors.cream,
              fontSize: 15,
            }}
          />
          <TouchableOpacity
            onPress={() => input.trim() && !streaming && send(input.trim())}
            disabled={!input.trim() || streaming}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: theme.colors.gold.DEFAULT,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !input.trim() || streaming ? 0.4 : 1,
            }}
          >
            {streaming ? <ActivityIndicator size="small" color={theme.colors.ink[900]} /> : <Send color={theme.colors.ink[900]} size={18} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <PayModal visible={showPay} onClose={() => setShowPay(false)} />
    </SafeAreaView>
  )
}

function Bubble({ message, streaming }: { message: Message; streaming?: boolean }) {
  const isUser = message.role === 'user'
  return (
    <View style={{ flexDirection: 'row', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <View
        style={{
          maxWidth: '82%',
          padding: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: isUser ? theme.colors.gold.DEFAULT : theme.colors.ink[700],
          borderColor: isUser ? 'transparent' : theme.colors.ink[600],
          borderWidth: 1,
        }}
      >
        <Text style={{ color: isUser ? theme.colors.ink[900] : theme.colors.ink[50], fontSize: 15, lineHeight: 22 }}>
          {message.content}
          {streaming ? <Text style={{ color: theme.colors.gold.DEFAULT }}>▋</Text> : null}
        </Text>
      </View>
    </View>
  )
}

function PayModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [token, setToken] = useState('USDC')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    const pocketId = await api.getPocketId()
    if (!pocketId) return
    setError('')
    setResult(null)
    setLoading(true)
    const { data, error } = await api.payViaAgent(pocketId, { to, amount, token })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setResult(data)
  }

  function reset() {
    setTo('')
    setAmount('')
    setToken('USDC')
    setResult(null)
    setError('')
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
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 40,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontFamily: 'Fraunces', fontSize: 22, color: theme.colors.cream }}>
              AI payment
            </Text>
            <TouchableOpacity onPress={reset}>
              <X color={theme.colors.ink[300]} size={24} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 13, color: theme.colors.ink[300], marginBottom: 20 }}>
            The agent picks the best wallet and routes through Solana.
          </Text>

          {result ? (
            <View>
              <View
                style={{
                  padding: 12,
                  backgroundColor: 'rgba(92, 116, 86, 0.1)',
                  borderColor: 'rgba(92, 116, 86, 0.3)',
                  borderWidth: 1,
                  borderRadius: 10,
                  marginBottom: 14,
                }}
              >
                <Text style={{ color: theme.colors.moss, fontSize: 14 }}>✓ Payment {result.status}</Text>
              </View>
              <Row label="Tx" value={result.txHash?.slice(0, 24) + '...' || ''} mono />
              <Row label="Amount" value={`${result.amount} ${result.token}`} />
              <Row label="Reasoning" value={result.reasoning} />
              <TouchableOpacity
                onPress={reset}
                style={{
                  backgroundColor: theme.colors.gold.DEFAULT,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 14,
                }}
              >
                <Text style={{ color: theme.colors.ink[900], fontSize: 15, fontWeight: '600' }}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <PayField label="Recipient" value={to} onChange={setTo} mono />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <PayField label="Amount" value={amount} onChange={setAmount} keyboardType="decimal-pad" />
                </View>
                <View style={{ width: 100 }}>
                  <Text style={{ fontSize: 13, color: theme.colors.ink[200], marginBottom: 8 }}>Token</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['USDC', 'SOL', 'USDT', 'BONK'].map((t) => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setToken(t)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 12,
                          marginRight: 6,
                          borderRadius: 10,
                          backgroundColor: token === t ? theme.colors.gold.DEFAULT : theme.colors.ink[900],
                          borderColor: theme.colors.ink[600],
                          borderWidth: 1,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: token === t ? theme.colors.ink[900] : theme.colors.cream,
                            fontWeight: '600',
                          }}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

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
                onPress={handlePay}
                disabled={loading || !to || !amount}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: theme.colors.gold.DEFAULT,
                  padding: 14,
                  borderRadius: 12,
                  opacity: loading || !to || !amount ? 0.5 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.ink[900]} />
                ) : (
                  <>
                    <Text style={{ color: theme.colors.ink[900], fontSize: 15, fontWeight: '600' }}>Pay</Text>
                    <ArrowRight color={theme.colors.ink[900]} size={16} />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function PayField({
  label,
  value,
  onChange,
  mono,
  keyboardType,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  mono?: boolean
  keyboardType?: 'default' | 'decimal-pad'
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, color: theme.colors.ink[200], marginBottom: 8 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
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
          fontFamily: mono ? 'JetBrainsMono' : undefined,
        }}
      />
    </View>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 6, gap: 12 }}>
      <Text style={{ color: theme.colors.ink[300], fontSize: 13, width: 80 }}>{label}</Text>
      <Text
        style={{
          flex: 1,
          color: theme.colors.cream,
          fontSize: 13,
          fontFamily: mono ? 'JetBrainsMono' : undefined,
        }}
      >
        {value}
      </Text>
    </View>
  )
}
