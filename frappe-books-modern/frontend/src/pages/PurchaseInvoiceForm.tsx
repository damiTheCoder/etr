import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Trash2, Plus } from 'lucide-react'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'

export default function PurchaseInvoiceForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { name } = useParams()
  const isEdit = !!name

  const poState = location.state as { party?: string; items?: any[]; date?: string } | null

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [taxes, setTaxes] = useState<any[]>([])

  const [party, setParty] = useState(poState?.party || '')
  const [date, setDate] = useState(poState?.date || new Date().toISOString().split('T')[0])
  const [discountPercent, setDiscountPercent] = useState(0)
  const [selectedTax, setSelectedTax] = useState('')
  const [customTaxRate, setCustomTaxRate] = useState<number | null>(null)
  const [lineItems, setLineItems] = useState<any[]>(
    poState?.items && poState.items.length > 0
      ? poState.items.map(it => ({ ...it, account: it.account || 'Cost of Goods Sold' }))
      : [{ item: '', quantity: 1, rate: 0, amount: 0, account: 'Cost of Goods Sold' }]
  )

  useEffect(() => {
    async function loadMasters() {
      try {
        const [p, i, t] = await Promise.all([api.list('Party'), api.list('Item'), api.list('Tax')])
        const filteredSuppliers = (p as any[]).filter(x => x.partyType === 'Supplier')
        setSuppliers(filteredSuppliers.length > 0 ? filteredSuppliers : (p as any[]))
        setItems(i as any[])
        setTaxes(t as any[])
      } catch (e) {
        console.error(e)
      }
    }
    loadMasters()
  }, [])

  function addItem() {
    setLineItems([...lineItems, { item: '', quantity: 1, rate: 0, amount: 0, account: 'Cost of Goods Sold' }])
  }

  function removeItem(index: number) {
    const updated = [...lineItems]
    updated.splice(index, 1)
    setLineItems(updated)
  }

  function handleItemNameChange(index: number, val: string) {
    const selected = items.find(it => it.name.toLowerCase() === val.trim().toLowerCase())
    const updated = [...lineItems]
    updated[index].item = val
    if (selected) {
      updated[index].rate = selected.rate || 0
      updated[index].account = selected.expenseAccount || 'Cost of Goods Sold'
      updated[index].amount = (updated[index].quantity || 1) * (selected.rate || 0)
    } else {
      updated[index].amount = (updated[index].quantity || 1) * (updated[index].rate || 0)
    }
    setLineItems(updated)
  }

  function handleQtyChange(index: number, qty: number) {
    const updated = [...lineItems]
    updated[index].quantity = qty
    updated[index].amount = qty * (updated[index].rate || 0)
    setLineItems(updated)
  }

  function handleRateChange(index: number, rate: number) {
    const updated = [...lineItems]
    updated[index].rate = rate
    updated[index].amount = (updated[index].quantity || 1) * rate
    setLineItems(updated)
  }

  const netTotal = lineItems.reduce((s, i) => s + (i.amount || 0), 0)
  const discountAmount = netTotal * (discountPercent || 0) / 100
  const selectedTaxObj = taxes.find(t => t.name === selectedTax)
  const taxRate = selectedTax === 'custom' 
    ? (customTaxRate || 0) 
    : (selectedTaxObj ? selectedTaxObj.rate : 0)
  const taxAmount = (netTotal - discountAmount) * (taxRate / 100)
  const grandTotal = netTotal - discountAmount + taxAmount

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!party.trim()) {
      alert("Please enter or select a supplier")
      return
    }
    if (lineItems.length === 0 || !lineItems.some(i => i.item.trim())) {
      alert("Please add at least one item with a name")
      return
    }

    try {
      const taxRows = taxRate > 0 ? [{
        tax: selectedTax === 'custom' ? `Custom Tax (${taxRate}%)` : (selectedTax || 'Input Tax'),
        account: selectedTaxObj?.account || 'Input Tax Credit',
        rate: taxRate,
        amount: taxAmount,
      }] : []

      const formattedItems = lineItems
        .filter(it => it.item.trim())
        .map(it => ({
          ...it,
          item: it.item.trim(),
          amount: (it.quantity || 1) * (it.rate || 0),
          baseAmount: (it.quantity || 1) * (it.rate || 0),
        }))

      const data = {
        party: party.trim(),
        date,
        numberSeries: 'PINV-',
        discountPercent,
        items: formattedItems,
        netTotal,
        discountAmount,
        taxTotal: taxAmount,
        grandTotal,
        baseGrandTotal: grandTotal,
        outstandingAmount: grandTotal,
        taxes: taxRows,
        account: 'Creditors',
      }
      const res = await api.create('PurchaseInvoice', data)
      await api.submit('PurchaseInvoice', res.name)
      navigate('/purchase-invoices')
    } catch (err: any) {
      alert(err.message || 'Failed to save purchase invoice')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <Link to="/purchase-invoices" className="shrink-0 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Purchase Invoice' : 'New Purchase Invoice'}</h1>
      </div>

      <form onSubmit={save} className="space-y-6 w-full max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
            <CardDescription>Basic information for this purchase invoice</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Supplier Name</Label>
                <Input
                  list="supplier-list"
                  placeholder="Type or select supplier..."
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  required
                />
                <datalist id="supplier-list">
                  {suppliers.map(p => (
                    <option key={p.name} value={p.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label className="mb-1.5 block">Date</Label>
                <Input value={date} onChange={(e) => setDate(e.target.value)} type="date" required />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>Add items received from supplier</CardDescription>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </CardHeader>
          <CardContent>
            {lineItems.length > 0 ? (
              <div className="table-scroll rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Item Name / Description</TableHead>
                      <TableHead className="w-[90px]">Qty</TableHead>
                      <TableHead className="w-[120px]">Rate ($)</TableHead>
                      <TableHead className="w-[120px] text-right">Amount ($)</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input
                            list={`item-list-${i}`}
                            placeholder="Type item name..."
                            value={item.item}
                            onChange={(e) => handleItemNameChange(i, e.target.value)}
                            required
                          />
                          <datalist id={`item-list-${i}`}>
                            {items.map(it => (
                              <option key={it.name} value={it.name}>
                                Rate: ${it.rate || 0}
                              </option>
                            ))}
                          </datalist>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="text-right"
                            value={item.quantity}
                            onChange={(e) => handleQtyChange(i, parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="text-right"
                            value={item.rate}
                            onChange={(e) => handleRateChange(i, parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">${(item.amount || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => removeItem(i)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12 border rounded-lg">
                No items added. Click "Add Item" to get started.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxes & Totals</CardTitle>
            <CardDescription>Configure tax and discount</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Tax</Label>
                <div className="flex gap-2">
                  <NativeSelect
                    value={selectedTax}
                    onChange={(e) => {
                      setSelectedTax(e.target.value)
                      if (e.target.value !== 'custom') setCustomTaxRate(null)
                    }}
                    className="flex-1"
                  >
                    <option value="">No Tax (0%)</option>
                    {taxes.map(t => (
                      <option key={t.name} value={t.name}>{t.name} ({t.rate}%)</option>
                    ))}
                    <option value="custom">Custom Tax Rate (%)</option>
                  </NativeSelect>
                  {selectedTax === 'custom' && (
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="Tax %"
                      className="w-24 text-right"
                      value={customTaxRate ?? ''}
                      onChange={(e) => setCustomTaxRate(parseFloat(e.target.value) || 0)}
                    />
                  )}
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">Discount %</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row justify-end gap-6 sm:gap-12">
              <div className="text-right">
                <p className="text-sm text-gray-500">Net Total</p>
                <p className="text-xl font-bold">${netTotal.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Tax ({taxRate}%)</p>
                <p className="text-xl font-bold text-orange-600">${taxAmount.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Grand Total</p>
                <p className="text-2xl font-bold text-gray-800">${grandTotal.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" asChild>
            <Link to="/purchase-invoices">Cancel</Link>
          </Button>
          <Button type="submit">Save & Submit Invoice</Button>
        </div>
      </form>
    </div>
  )
}
