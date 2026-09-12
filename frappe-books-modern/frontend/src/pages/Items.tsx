import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'

export default function Items() {
  const [items, setItems] = useState<any[]>([])

  function formatNumber(v: number) {
    return Number(v || 0).toFixed(2)
  }

  async function loadItems() {
    try {
      const data = await api.list('Item')
      setItems(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  async function deleteItem(name: string) {
    if (!confirm(`Delete item ${name}?`)) return
    try {
      await api.delete('Item', name)
      loadItems()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Items</h1>
          <p className="text-sm text-gray-500 mt-1">Products and services you sell or buy</p>
        </div>
        <Button asChild>
          <Link to="/items/new">New Item</Link>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold">All Items</h2>
            <span className="text-sm text-gray-500">{items.length} items total</span>
          </div>
          <Button asChild size="sm">
            <Link to="/items/new">New Item</Link>
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-center">Unit</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Income Account</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.name}>
                <TableCell className="font-medium">
                  <Link to={`/items/${item.name}`} className="text-gray-700 hover:text-gray-900 hover:underline">
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono">${formatNumber(item.rate)}</TableCell>
                <TableCell className="text-center">{item.unit}</TableCell>
                <TableCell>
                  <Badge variant={item.itemType === 'Product' ? 'default' : 'secondary'}>
                    {item.itemType}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500">{item.incomeAccount || '-'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/items/${item.name}`}>Edit</Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => deleteItem(item.name)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400 py-12">
                  No items yet. Add your first product or service.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
