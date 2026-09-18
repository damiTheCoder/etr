import React, { useEffect, useState } from 'react'
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
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-black border border-black">
            Period Closed ({checklist.period})
          </span>
        )}
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0">
          <CardTitle className="text-black">Pre-Close Checklist</CardTitle>
          <CardDescription>Complete all items before closing the period</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="space-y-3">
            {checklist.checks?.map((check: any) => (
              <div
                key={check.name}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-black">
                    {check.name}
                  </span>
                </div>
                <Badge variant={check.passed ? 'default' : 'secondary'} className="text-black bg-transparent border border-slate-300">
                  {check.passed ? 'Passed' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0">
          <CardTitle className="text-black">Close Status</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="flex items-center justify-between p-4 bg-slate-200 rounded-lg">
            <div>
              <p className="text-sm text-black">Ready to close period ({checklist.period})</p>
              <p className="text-2xl font-bold text-black">
                {checklist.is_closed ? 'Closed' : checklist.ready_to_close ? 'Yes' : 'No'}
              </p>
            </div>
            <Button
              disabled={!checklist.ready_to_close || checklist.is_closed || closing}
              onClick={closePeriod}
              className="bg-blue-600 hover:bg-blue-700 text-white border border-black font-semibold"
            >
              {checklist.is_closed ? 'Period Locked' : closing ? 'Closing...' : 'Close Period'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
