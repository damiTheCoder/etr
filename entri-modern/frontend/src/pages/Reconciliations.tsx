import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/context/CompanyContext'

export default function Reconciliations() {
  const { formatCurrency } = useCompany()
  const [reconciliations, setReconciliations] = useState<any[]>([])

  const formatNumber = (v: number) => Number(v || 0).toFixed(2)

  useEffect(() => {
    async function loadReconciliations() {
      try {
        const data = await api.list('Reconciliation')
        setReconciliations(data || [])
      } catch (e) {
        console.error('Failed to load reconciliations:', e)
      }
    }
    loadReconciliations()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reconciliations</h1>
          <p className="text-sm text-gray-500 mt-1">Bank and account reconciliations</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/reconciliations/new">New Reconciliation</Link>
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reconciliation #</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Closing Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciliations.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">
                    <Link to={`/reconciliations/${r.name}`} className="text-gray-700 hover:text-gray-900">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-500">{r.account}</TableCell>
                  <TableCell className="text-gray-500">{r.date}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(r.closingBalance)}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'Completed' ? 'default' : r.submitted ? 'secondary' : 'outline'}>
                      {r.status || 'Draft'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {reconciliations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    No reconciliations yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
