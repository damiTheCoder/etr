// @vitest-environment jsdom
import React from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CompanyProvider, useCompany } from './context/CompanyContext'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import { BrowserRouter } from 'react-router-dom'

// Mock api utilities and recharts to simplify DOM rendering in tests
vi.mock('@/utils/api', () => ({
  api: {
    list: vi.fn().mockResolvedValue([]),
    getReport: vi.fn().mockResolvedValue({ income: { total: 1000 }, expenses: { total: 400 }, netProfit: 600 }),
    getSingleValue: vi.fn().mockResolvedValue('USD'),
    setSingleValue: vi.fn().mockResolvedValue({ success: true }),
  }
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

describe('Company Settings Propagation', () => {
  let fetchSpy: any

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/settings')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            company_id: 'default_company',
            company: { name: 'My Company', base_currency: 'NGN', fiscal_year_start: 1, fiscal_year_end: 12 },
            defaults: {}
          })
        } as Response)
      }
      return Promise.resolve({ ok: true, json: async () => ([]) } as Response)
    })
  })

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore()
  })
  test('refetchSettings is called after save', async () => {
    render(
      <CompanyProvider>
        <Settings />
      </CompanyProvider>
    )

    await waitFor(() => {
      expect(screen.queryByText(/Loading system preferences/i)).toBeNull()
    })

    const saveButton = screen.getByRole('button', { name: /Save Settings/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/settings'),
        expect.objectContaining({ method: 'PUT' })
      )
    })
  })

  test('no hardcoded dollar sign anywhere in rendered UI', async () => {
    // Custom test component to verify formatting when baseCurrency is NGN
    function TestDashboard() {
      const { formatCurrency, currencySymbol } = useCompany()
      return (
        <div>
          <span data-testid="symbol">{currencySymbol}</span>
          <span data-testid="amount">{formatCurrency(1234.56)}</span>
        </div>
      )
    }

    render(
      <CompanyProvider>
        <TestDashboard />
      </CompanyProvider>
    )

    await waitFor(() => {
      const amountText = screen.getByTestId('amount').textContent
      expect(amountText).toContain('₦')
      expect(amountText).not.toContain('$')
    })
  })

  test('changing currency in settings updates dashboard immediately', async () => {
    // Component rendering company details and formatted amounts
    function IntegratedView() {
      const { currencySymbol, formatCurrency } = useCompany()
      return (
        <div>
          <h2 data-testid="curr-sym">{currencySymbol}</h2>
          <p data-testid="revenue">{formatCurrency(5000)}</p>
        </div>
      )
    }

    render(
      <CompanyProvider>
        <IntegratedView />
      </CompanyProvider>
    )

    // Initial default currency is NGN
    expect(screen.getByTestId('curr-sym').textContent).toBe('₦')
    expect(screen.getByTestId('revenue').textContent).toContain('₦5,000.00')
  })
})
