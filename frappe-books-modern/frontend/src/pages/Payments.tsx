import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function Payments() {
  const [payments, setPayments] = useState<any[]>([])

  function formatNumber(v: number) {
    return Number(v || 0).toFixed(2)
  }

  function statusVariant(p: any): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (p.cancelled) return 'destructive'
    if (p.submitted) return 'default'
    return 'secondary'
  }

  function statusLabel(p: any): string {
    if (p.cancelled) return 'Cancelled'
    if (p.submitted) return 'Submitted'
    return 'Draft'
  }

  async function loadPayments() {
    try {
      const data = await api.list('Payment')
      setPayments(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [])

  const totalReceived = payments
    .filter(p => p.paymentType === 'Receive' && p.submitted && !p.cancelled)
    .reduce((s, p) => s + Number(p.amount || 0), 0)

  const totalPaid = payments
    .filter(p => p.paymentType === 'Pay' && p.submitted && !p.cancelled)
    .reduce((s, p) => s + Number(p.amount || 0), 0)

  const netFlow = totalReceived - totalPaid

  async function submitPayment(name: string) {
    try {
      await api.submit('Payment', name)
      loadPayments()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function cancelPayment(name: string) {
    if (!confirm(`Cancel payment ${name}?`)) return
    try {
      await api.cancel('Payment', name)
      loadPayments()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">Track money received and paid</p>
        </div>
        <Button asChild>
          <Link to="/payments/new">New Payment</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${formatNumber(totalReceived)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${formatNumber(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Net Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${formatNumber(netFlow)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold">All Payments</h2>
            <span className="text-sm text-gray-500">{payments.length} payments total</span>
          </div>
          <Button asChild size="sm">
            <Link to="/payments/new">New Payment</Link>
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium">
                  <Link to={`/payments/${p.name}`} className="text-gray-700 hover:text-gray-900 hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>{p.party}</TableCell>
                <TableCell className="text-gray-500">{p.date}</TableCell>
                <TableCell>
                  <Badge variant={p.paymentType === 'Receive' ? 'default' : 'secondary'}>
                    {p.paymentType}
                  </Badge>
                </TableCell>
                <TableCell>{p.paymentMethod || '-'}</TableCell>
                <TableCell className="text-right font-mono">${formatNumber(p.amount)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={statusVariant(p)}>{statusLabel(p)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    {!p.submitted && (
                      <Button variant="ghost" size="sm" onClick={() => submitPayment(p.name)}>
                        Submit
                      </Button>
                    )}
                    {p.submitted && !p.cancelled && (
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => cancelPayment(p.name)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-400 py-12">
                  No payments yet. Record your first payment to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
