import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function PurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])

  const formatNumber = (v: number) => Number(v || 0).toFixed(2)

  useEffect(() => {
    async function loadPO() {
      try {
        const data = await api.list('PurchaseOrder')
        setPurchaseOrders(data || [])
      } catch (e) {
        console.error('Failed to load purchase orders:', e)
      }
    }
    loadPO()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage purchase orders from suppliers</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/purchase-orders/new">New Purchase Order</Link>
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.name}>
                  <TableCell className="font-medium">
                    <Link to={`/purchase-orders/${po.name}`} className="text-gray-700 hover:text-gray-900">
                      {po.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-500">{po.party}</TableCell>
                  <TableCell className="text-gray-500">{po.date}</TableCell>
                  <TableCell className="text-right font-mono text-sm">${formatNumber(po.baseGrandTotal)}</TableCell>
                  <TableCell>
                    <Badge variant={po.status === 'Received' ? 'default' : po.submitted ? 'secondary' : 'outline'}>
                      {po.status || 'Draft'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {purchaseOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    No purchase orders yet
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
