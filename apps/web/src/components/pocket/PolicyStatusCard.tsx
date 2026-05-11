'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Shield, ShieldOff, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { formatUsd } from '@/lib/format'

interface PolicyState {
  enabled: boolean
  maxPerTxUsd: number | null
  maxPerDayUsd: number | null
  allowedRecipients: string[]
  blockedRecipients: string[]
  allowedTokens: string[]
  blockedTokens: string[]
}

/**
 * PolicyStatusCard surfaces the guardrails on the dashboard.
 * - If policy is OFF: prompts the user to set one up (unmissable)
 * - If policy is ON: shows daily budget usage with a live bar
 *
 * This is what makes Clutch's value prop tangible. Without this card,
 * a new user has no idea the policy engine even exists.
 */
export function PolicyStatusCard() {
  const [policy, setPolicy] = useState<PolicyState | null>(null)
  const [spentToday, setSpentToday] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    load()
  }, [])

  // Refresh the daily spend number every 60s — feels alive without being noisy
  useEffect(() => {
    if (!policy?.enabled) return
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [policy?.enabled])

  async function load() {
    const pocketId = api.getPocketId()
    if (!pocketId) return
    const { data } = await api.getPolicy(pocketId)
    if (data) {
      setPolicy(data.policy)
      setSpentToday(data.spentTodayUsd)
    }
    setLoaded(true)
  }

  if (!loaded) return null

  // Policy off — prompt to enable
  if (!policy || !policy.enabled) {
    return (
      <Link
        href="/dashboard/policy"
        className="group flex items-center justify-between p-5 rounded-xl border border-gold/20 bg-gradient-to-r from-gold/5 to-transparent hover:border-gold/40 transition"
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
            <ShieldOff className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display text-lg text-cream">Spending guardrails are off</p>
            <p className="text-sm text-ink-300">
              Set per-transaction and daily limits so the agent can't drain your pocket — even if it hallucinates.
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-gold group-hover:translate-x-0.5 transition shrink-0 ml-4" />
      </Link>
    )
  }

  // Policy on — show daily budget with a live bar
  const dayPct = policy.maxPerDayUsd
    ? Math.min(100, (spentToday / policy.maxPerDayUsd) * 100)
    : 0
  const remaining = policy.maxPerDayUsd ? Math.max(0, policy.maxPerDayUsd - spentToday) : null

  // Count active rules so the user sees there's enforcement happening
  const activeRules = [
    policy.maxPerTxUsd !== null,
    policy.maxPerDayUsd !== null,
    policy.allowedRecipients.length > 0,
    policy.blockedRecipients.length > 0,
    policy.allowedTokens.length > 0,
    policy.blockedTokens.length > 0,
  ].filter(Boolean).length

  return (
    <Link
      href="/dashboard/policy"
      className="group block p-5 rounded-xl border border-moss/30 bg-moss/5 hover:bg-moss/10 transition"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-xl bg-moss/10 border border-moss/20 flex items-center justify-center text-moss shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-display text-lg text-cream">Guardrails active</p>
              <span className="text-xs text-moss tabular">
                {activeRules} {activeRules === 1 ? 'rule' : 'rules'}
              </span>
            </div>
            {policy.maxPerDayUsd ? (
              <>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-ink-300">
                    Spent today:{' '}
                    <span className="tabular text-cream">{formatUsd(spentToday)}</span>{' '}
                    <span className="text-ink-400">
                      of {formatUsd(policy.maxPerDayUsd)}
                    </span>
                  </span>
                  <span className="tabular text-ink-300">
                    {remaining !== null ? `${formatUsd(remaining)} left` : ''}
                  </span>
                </div>
                <div className="h-1.5 bg-ink-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      dayPct >= 100 ? 'bg-rust' : dayPct >= 80 ? 'bg-gold' : 'bg-moss'
                    }`}
                    style={{ width: `${dayPct}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-300">
                Recipient and token rules active. Set a daily limit for stricter control.
              </p>
            )}
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-ink-400 group-hover:text-moss group-hover:translate-x-0.5 transition shrink-0" />
      </div>
    </Link>
  )
}
