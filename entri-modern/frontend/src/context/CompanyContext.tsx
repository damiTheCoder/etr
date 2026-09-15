import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface CompanyContextValue {
  companyName: string
  baseCurrency: string
  currencySymbol: string
  fiscalYearStart: number
  fiscalYearEnd: number
  formatCurrency: (amount: number | string) => string
  refetchSettings: () => Promise<void>
  isLoading: boolean
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  KES: 'KSh',
  GHS: '₵',
  ZAR: 'R',
}

const CompanyContext = createContext<CompanyContextValue>({
  companyName: 'My Company',
  baseCurrency: 'NGN',
  currencySymbol: '₦',
  fiscalYearStart: 1,
  fiscalYearEnd: 12,
  formatCurrency: (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '₦0.00'
    return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  },
  refetchSettings: async () => {},
  isLoading: true,
})

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({
    companyName: 'My Company',
    baseCurrency: 'NGN',
    fiscalYearStart: 1,
    fiscalYearEnd: 12,
    isLoading: true,
  })

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load settings')
      const data = await res.json()
      setState({
        companyName: data.company?.name ?? 'My Company',
        baseCurrency: data.company?.base_currency ?? 'NGN',
        fiscalYearStart: data.company?.fiscal_year_start ?? 1,
        fiscalYearEnd: data.company?.fiscal_year_end ?? 12,
        isLoading: false,
      })
    } catch (err) {
      console.error('Settings fetch failed:', err)
      setState((s) => ({ ...s, isLoading: false }))
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const currencySymbol = CURRENCY_SYMBOLS[state.baseCurrency] ?? state.baseCurrency

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return `${currencySymbol}0.00`
    return `${currencySymbol}${num.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return (
    <CompanyContext.Provider
      value={{
        ...state,
        currencySymbol,
        formatCurrency,
        refetchSettings: fetchSettings,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export const useCompany = () => useContext(CompanyContext)

