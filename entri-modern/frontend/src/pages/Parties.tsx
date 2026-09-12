import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'

export default function Parties() {
  const [parties, setParties] = useState<any[]>([])

  async function loadParties() {
    try {
      const data = await api.list('Party')
      setParties(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadParties()
  }, [])

  async function deleteParty(name: string) {
    if (!confirm(`Delete party ${name}?`)) return
    try {
      await api.delete('Party', name)
      loadParties()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Parties</h1>
          <p className="text-sm text-gray-500 mt-1">Customers, suppliers, and other contacts</p>
        </div>
        <Button asChild>
          <Link to="/parties/new">New Party</Link>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold">All Parties</h2>
            <span className="text-sm text-gray-500">{parties.length} parties total</span>
          </div>
          <Button asChild size="sm">
            <Link to="/parties/new">New Party</Link>
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Tax ID</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parties.map((p) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium">
                  <Link to={`/parties/${p.name}`} className="text-gray-700 hover:text-gray-900 hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={p.partyType === 'Supplier' ? 'secondary' : p.partyType === 'Both' ? 'default' : 'outline'}>
                    {p.partyType}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500">{p.email || '-'}</TableCell>
                <TableCell className="text-gray-500">{p.phone || '-'}</TableCell>
                <TableCell className="text-gray-500">{p.taxId || '-'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/parties/${p.name}`}>Edit</Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => deleteParty(p.name)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {parties.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400 py-12">
                  No parties yet. Add your first customer or supplier.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
