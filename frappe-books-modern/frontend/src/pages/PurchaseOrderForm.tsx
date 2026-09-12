import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Plus, FileText } from 'lucide-react'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function PurchaseOrderForm() {
  const navigate = useNavigate()
  const { name } = useParams()
  const isEdit = !!name

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [parties, setParties] = useState<any[]>([])
  const [itemsList, setItemsList] = useState<any[]>([])

  const [party, setParty] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [items, setItems] = useState<any[]>([
    { item: '', quantity: 1, rate: 0, amount: 0, account: 'Cost of Goods Sold' }
  ])
  const [taxes, setTaxes] = useState<any[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState('Draft')

  const formatNumber = (v: number) => Number(v || 0).toFixed(2)

  useEffect(() => {
    async function loadData() {
      try {
        const [partiesData, itemsData] = await Promise.all([
          api.list('Party'),
          api.list('Item'),
        ])
        const filteredSuppliers = (partiesData as any[]).filter(x => x.partyType === 'Supplier')
        setParties(filteredSuppliers.length > 0 ? filteredSuppliers : (partiesData as any[]))
        setItemsList(itemsData as any[])

        if (isEdit && name) {
          const doc = await api.get('PurchaseOrder', name)
          setParty(doc.party || '')
          setDate(doc.date || new Date().toISOString().split('T')[0])
          setExpectedDeliveryDate(doc.expectedDeliveryDate || '')
          setCurrency(doc.currency || 'USD')
          setItems(doc.items && doc.items.length > 0 ? doc.items : [
            { item: '', quantity: 1, rate: 0, amount: 0, account: 'Cost of Goods Sold' }
          ])
          setTaxes(doc.taxes || [])
          setSubmitted(doc.submitted || false)
          setStatus(doc.status || 'Draft')
        }
      } catch (e) {
        console.error('Failed to load:', e)
      }
      setLoading(false)
    }
    loadData()
  }, [isEdit, name])

  function addItem() {
    setItems([...items, { item: '', quantity: 1, rate: 0, amount: 0, account: 'Cost of Goods Sold' }])
  }

  function removeItem(idx: number) {
    const updated = [...items]
    updated.splice(idx, 1)
    setItems(updated)
  }

  function handleItemChange(idx: number, val: string) {
    const updated = [...items]
    updated[idx].item = val
    const found = itemsList.find(i => i.name.toLowerCase() === val.trim().toLowerCase())
    if (found) {
      updated[idx].rate = found.rate || 0
      updated[idx].amount = (updated[idx].quantity || 1) * (found.rate || 0)
    } else {
      updated[idx].amount = (updated[idx].quantity || 1) * (updated[idx].rate || 0)
    }
    setItems(updated)
  }

  function handleQtyChange(idx: number, qty: number) {
    const updated = [...items]
    updated[idx].quantity = qty
    updated[idx].amount = qty * (updated[idx].rate || 0)
    setItems(updated)
  }

  function handleRateChange(idx: number, rate: number) {
    const updated = [...items]
    updated[idx].rate = rate
    updated[idx].amount = (updated[idx].quantity || 1) * rate
    setItems(updated)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!party.trim()) {
      alert("Please enter or select a supplier")
      return
    }
    try {
      const formattedItems = items
        .filter(it => it.item.trim())
        .map(it => ({
          ...it,
          item: it.item.trim(),
          amount: (it.quantity || 1) * (it.rate || 0),
        }))

      const data = {
        party: party.trim(),
        date,
        expectedDeliveryDate,
        currency,
        items: formattedItems,
        taxes,
        status,
        submitted,
      }
      if (isEdit && name) {
        await api.update('PurchaseOrder', name, data)
      } else {
        await api.create('PurchaseOrder', data)
      }
      navigate('/purchase-orders')
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function submitPO() {
    if (!name) return
    try {
      setSubmitting(true)
      await api.submit('PurchaseOrder', name)
      setSubmitted(true)
      setStatus('Submitted')
      alert('Purchase Order submitted successfully')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function convertToInvoice() {
    if (!party) return
    navigate('/purchase-invoices/new', {
      state: {
        party,
        items,
        date,
      }
    })
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 sm:gap-4 mb-2">
        <Link to="/purchase-orders" className="shrink-0 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{isEdit ? name : 'Create a new purchase order for supplier'}</p>
        </div>
        {isEdit && (
          <div className="flex gap-2">
            {!submitted && (
              <Button variant="outline" onClick={submitPO} disabled={submitting}>
                Submit PO
              </Button>
            )}
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={convertToInvoice}>
              <FileText className="w-4 h-4 mr-1.5" /> Convert to Invoice
            </Button>
          </div>
        )}
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Purchase Order Details</CardTitle>
            <CardDescription>Supplier and order schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Supplier Name</Label>
                <Input
                  list="po-supplier-list"
                  placeholder="Type or select supplier..."
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  required
                />
                <datalist id="po-supplier-list">
                  {parties.map(p => (
                    <option key={p.name} value={p.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label className="mb-1.5 block">Date</Label>
                <Input value={date} onChange={(e) => setDate(e.target.value)} type="date" required />
              </div>
              <div>
                <Label className="mb-1.5 block">Expected Delivery Date</Label>
                <Input value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} type="date" />
              </div>
              <div>
                <Label className="mb-1.5 block">Currency</Label>
                <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </NativeSelect>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>Add items to this purchase order</CardDescription>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Label className="mb-1 block text-xs">Item Name / Description</Label>
                    <Input
                      list={`po-item-list-${idx}`}
                      placeholder="Type item name..."
                      value={item.item}
                      onChange={(e) => handleItemChange(idx, e.target.value)}
                      required
                    />
                    <datalist id={`po-item-list-${idx}`}>
                      {itemsList.map(it => (
                        <option key={it.name} value={it.name}>
                          Rate: ${it.rate || 0}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="col-span-2">
                    <Label className="mb-1 block text-xs">Qty</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="text-right"
                      value={item.quantity}
                      onChange={(e) => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="mb-1 block text-xs">Rate ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="text-right"
                      value={item.rate}
                      onChange={(e) => handleRateChange(idx, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="mb-1 block text-xs">Amount ($)</Label>
                    <Input value={((item.quantity || 0) * (item.rate || 0)).toFixed(2)} disabled className="bg-gray-100 font-mono text-right" />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-red-600" onClick={() => removeItem(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" asChild>
            <Link to="/purchase-orders">Cancel</Link>
          </Button>
          <Button type="submit">Save Purchase Order</Button>
        </div>
      </form>
    </div>
  )
}
