import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ItemForm() {
  const navigate = useNavigate()
  const { name } = useParams()
  const isEdit = !!name

  const [loading, setLoading] = useState(true)
  const [incomeAccounts, setIncomeAccounts] = useState<any[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([])
  const [taxOptions, setTaxOptions] = useState<any[]>([])

  const units = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Pcs', 'Set', 'Hour', 'Day']

  const [itemName, setItemName] = useState('')
  const [rate, setRate] = useState(0)
  const [unit, setUnit] = useState('Nos')
  const [itemType, setItemType] = useState('Product')
  const [stockUom, setStockUom] = useState('Nos')
  const [incomeAccount, setIncomeAccount] = useState('')
  const [expenseAccount, setExpenseAccount] = useState('')
  const [tax, setTax] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const [accs, taxes] = await Promise.all([
          api.list('Account'),
          api.list('Tax'),
        ])
        const allAccounts = accs as any[]
        setIncomeAccounts(allAccounts.filter(a => a.rootType === 'Income'))
        setExpenseAccounts(allAccounts.filter(a => a.rootType === 'Expense'))
        setTaxOptions(taxes as any[])

        if (isEdit && name) {
          const doc = await api.get('Item', name)
          setItemName(doc.name || '')
          setRate(doc.rate || 0)
          setUnit(doc.unit || 'Nos')
          setItemType(doc.itemType || 'Product')
          setStockUom(doc.stockUom || 'Nos')
          setIncomeAccount(doc.incomeAccount || '')
          setExpenseAccount(doc.expenseAccount || '')
          setTax(doc.tax || '')
          setDescription(doc.description || '')
        }
      } catch (e: any) {
        alert(e.message)
        navigate('/items')
      }
      setLoading(false)
    }
    loadData()
  }, [isEdit, name, navigate])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        name: itemName,
        rate,
        unit,
        itemType,
        stockUom,
        incomeAccount,
        expenseAccount,
        tax,
        description,
      }
      if (isEdit && name) {
        await api.update('Item', name, data)
      } else {
        await api.create('Item', data)
      }
      navigate('/items')
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-400">Loading...</CardContent>
      </Card>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <Link to="/items" className="shrink-0 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Item' : 'New Item'}</h1>
      </div>

      <form onSubmit={save} className="space-y-6 w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Item Details</CardTitle>
            <CardDescription>{isEdit ? 'Update item information' : 'Add a new product or service'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Item Name</Label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
                disabled={isEdit}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Rate</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Item Type</Label>
                <NativeSelect value={itemType} onChange={(e) => setItemType(e.target.value)}>
                  <option value="Product">Product</option>
                  <option value="Service">Service</option>
                </NativeSelect>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Unit</Label>
                <NativeSelect value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {units.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Stock UOM</Label>
                <NativeSelect value={stockUom} onChange={(e) => setStockUom(e.target.value)}>
                  {units.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Income Account</Label>
              <NativeSelect value={incomeAccount} onChange={(e) => setIncomeAccount(e.target.value)}>
                <option value="">Select...</option>
                {incomeAccounts.map(a => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="mb-1.5 block">Expense Account</Label>
              <NativeSelect value={expenseAccount} onChange={(e) => setExpenseAccount(e.target.value)}>
                <option value="">Select...</option>
                {expenseAccounts.map(a => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="mb-1.5 block">Tax</Label>
              <NativeSelect value={tax} onChange={(e) => setTax(e.target.value)}>
                <option value="">None</option>
                {taxOptions.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="mb-1.5 block">Description</Label>
              <Textarea
                rows={3}
                placeholder="Enter item description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" asChild>
            <Link to="/items">Cancel</Link>
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  )
}
