import React, { useEffect, useState } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function CloseChecklist() {
  const [checklist, setChecklist] = useState<any>({ period: '', checks: [], ready_to_close: false, is_closed: false })
  const [closing, setClosing] = useState(false)

  async function loadData() {
    try {
      const data = await api.getReport('close-checklist')
      setChecklist(data || { period: '', checks: [], ready_to_close: false, is_closed: false })
    } catch (e) {
      console.error('Failed to load close checklist:', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function closePeriod() {
    if (!checklist.period) return
    try {
      setClosing(true)
      await api.closePeriod(checklist.period)
      await loadData()
      alert(`Financial period ${checklist.period} closed successfully!`)
    } catch (err: any) {
      alert(err.message || 'Failed to close period')
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Close Management</h1>
          <p className="text-sm text-gray-500 mt-1">Month-end close checklist for {checklist.period}</p>
        </div>
        {checklist.is_closed && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-4 h-4" /> Period Closed ({checklist.period})
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pre-Close Checklist</CardTitle>
          <CardDescription>Complete all items before closing the period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checklist.checks?.map((check: any) => (
              <div
                key={check.name}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  check.passed ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      check.passed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {check.passed && <Check className="w-3 h-3" />}
                  </div>
                  <span className={`text-sm font-medium ${check.passed ? 'text-green-900' : 'text-gray-700'}`}>
                    {check.name}
                  </span>
                </div>
                <Badge variant={check.passed ? 'default' : 'secondary'}>
                  {check.passed ? 'Passed' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Close Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Ready to close period ({checklist.period})</p>
              <p className={`text-2xl font-bold ${checklist.is_closed ? 'text-emerald-600' : checklist.ready_to_close ? 'text-green-600' : 'text-gray-900'}`}>
                {checklist.is_closed ? 'Closed ✓' : checklist.ready_to_close ? 'Yes' : 'No'}
              </p>
            </div>
            <Button
              disabled={!checklist.ready_to_close || checklist.is_closed || closing}
              onClick={closePeriod}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {checklist.is_closed ? 'Period Locked' : closing ? 'Closing...' : 'Close Period'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
