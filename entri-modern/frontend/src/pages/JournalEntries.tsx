import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { useCompany } from '@/context/CompanyContext'

export default function JournalEntries() {
  const { formatCurrency } = useCompany()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<any[]>([])

  function formatNumber(v: number) {
    return Number(v || 0).toFixed(2)
  }

  function statusVariant(je: any): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (je.cancelled) return 'destructive'
    if (je.submitted) return 'default'
    return 'secondary'
  }

  function statusLabel(je: any): string {
    if (je.cancelled) return 'Cancelled'
    if (je.submitted) return 'Submitted'
    return 'Draft'
  }

  async function loadEntries() {
    try {
      const data = await api.list('JournalEntry')
      setEntries(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [])

  async function submitEntry(name: string) {
    try {
      await api.submit('JournalEntry', name)
      loadEntries()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function cancelEntry(name: string) {
    if (!confirm(`Cancel journal entry ${name}?`)) return
    try {
      await api.cancel('JournalEntry', name)
      loadEntries()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Journal Entries</h1>
          <p className="text-sm text-gray-500 mt-1">Record and manage manual journal entries</p>
        </div>
        <Button asChild>
          <Link to="/journal-entries/new">New Journal Entry</Link>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold">All Journal Entries</h2>
            <span className="text-sm text-gray-500">{entries.length} entries total</span>
          </div>
          <Button asChild size="sm">
            <Link to="/journal-entries/new">New Journal Entry</Link>
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((je) => (
              <TableRow
                key={je.name}
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => navigate(`/journal-entries/${je.name}`)}
              >
                <TableCell className="font-medium text-blue-600 font-mono">
                  <Link
                    to={`/journal-entries/${je.name}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {je.name}
                  </Link>
                </TableCell>
                <TableCell className="text-gray-500">{je.date}</TableCell>
                <TableCell>{je.entryType}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(je.totalDebit)}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(je.totalCredit)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={statusVariant(je)}>{statusLabel(je)}</Badge>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link to={`/journal-entries/${je.name}`}>
                        {je.submitted ? 'View / Edit' : 'Edit'}
                      </Link>
                    </Button>
                    {!je.submitted && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white border border-black"
                        onClick={() => submitEntry(je.name)}
                      >
                        Post
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400 py-12">
                  No journal entries yet. Create your first entry to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
