import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useCompany } from '@/context/CompanyContext'

export default function SalesInvoices() {
  const { formatCurrency } = useCompany()
  const [invoices, setInvoices] = useState<any[]>([])

  function formatNumber(v: number) {
    return Number(v || 0).toFixed(2)
  }

  async function loadInvoices() {
    try {
      const data = await api.list('SalesInvoice')
      setInvoices(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  async function submitInvoice(name: string) {
    try {
      await api.submit('SalesInvoice', name)
      loadInvoices()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function cancelInvoice(name: string) {
    if (!confirm(`Cancel invoice ${name}?`)) return
    try {
      await api.cancel('SalesInvoice', name)
      loadInvoices()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function markAsPaid(name: string) {
    try {
      await api.markPaid('SalesInvoice', name)
      loadInvoices()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function markAsUnpaid(name: string) {
    try {
      await api.markUnpaid('SalesInvoice', name)
      loadInvoices()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Sales Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your sales invoices and track payments</p>
        </div>
        <Button asChild>
          <Link to="/sales-invoices/new">New Invoice</Link>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold">All Sales Invoices</h2>
            <span className="text-sm text-gray-500">{invoices.length} invoices total</span>
          </div>
          <Button asChild size="sm">
            <Link to="/sales-invoices/new">New Invoice</Link>
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const isPaid = inv.submitted && !inv.cancelled && Number(inv.outstandingAmount || 0) <= 0
              const isUnpaid = inv.submitted && !inv.cancelled && Number(inv.outstandingAmount || 0) > 0

              return (
                <TableRow key={inv.name}>
                  <TableCell className="font-medium">
                    <Link to={`/sales-invoices/${inv.name}`} className="text-gray-700 hover:text-gray-900 hover:underline">
                      {inv.name}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.party}</TableCell>
                  <TableCell className="text-gray-500">{inv.date}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(inv.baseGrandTotal)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(inv.outstandingAmount)}</TableCell>
                  <TableCell className="text-center">
                    {inv.cancelled ? (
                      <Badge variant="destructive">Cancelled</Badge>
                    ) : isPaid ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                      </span>
                    ) : inv.submitted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Unpaid
                      </span>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end items-center">
                      {!inv.submitted && !inv.cancelled && (
                        <Button variant="outline" size="sm" onClick={() => submitInvoice(inv.name)}>
                          Submit
                        </Button>
                      )}
                      {isUnpaid && (
                        <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => markAsPaid(inv.name)}>
                          Mark Paid
                        </Button>
                      )}
                      {isPaid && (
                        <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => markAsUnpaid(inv.name)}>
                          Mark Unpaid
                        </Button>
                      )}
                      {inv.submitted && !inv.cancelled && (
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => cancelInvoice(inv.name)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400 py-12">
                  No sales invoices yet. Create your first invoice to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
