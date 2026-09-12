import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PaymentForm() {
  const navigate = useNavigate()
  const { name } = useParams()
  const isEdit = !!name

  const [parties, setParties] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])

  const [party, setParty] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState(0)
  const [paymentType, setPaymentType] = useState('Receive')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [account, setAccount] = useState('Cash')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [clearanceDate, setClearanceDate] = useState('')
  const [userRemark, setUserRemark] = useState('')

  useEffect(() => {
    async function loadMasters() {
      try {
        const [p, a] = await Promise.all([api.list('Party'), api.list('Account')])
        setParties(p as any[])
        const filteredAccounts = (a as any[]).filter(acc => ['Cash', 'Bank'].includes(acc.accountType) || acc.name === 'Cash' || acc.name === 'Bank')
        setAccounts(filteredAccounts.length > 0 ? filteredAccounts : (a as any[]))
      } catch (e) {
        console.error(e)
      }
    }
    loadMasters()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        party,
        date,
        amount,
        paymentType,
        paymentMethod,
        account,
        referenceNumber,
        clearanceDate,
        userRemark,
        numberSeries: 'PAY-',
      }
      const res = await api.create('Payment', data)
      await api.submit('Payment', res.name)
      navigate('/payments')
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <Link to="/payments" className="shrink-0 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Payment' : 'New Payment'}</h1>
      </div>

      <form onSubmit={save} className="space-y-6 w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
            <CardDescription>Record a payment received or made</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Party</Label>
                <NativeSelect value={party} onChange={(e) => setParty(e.target.value)} required>
                  <option value="">Select party...</option>
                  {parties.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Date</Label>
                <Input value={date} onChange={(e) => setDate(e.target.value)} type="date" required />
              </div>
              <div>
                <Label className="mb-1.5 block">Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Type</Label>
                <NativeSelect value={paymentType} onChange={(e) => setPaymentType(e.target.value)} required>
                  <option value="Receive">Receive (from customer)</option>
                  <option value="Pay">Pay (to supplier)</option>
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Payment Method</Label>
                <NativeSelect value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Transfer">Bank Transfer</option>
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Account</Label>
                <NativeSelect value={account} onChange={(e) => setAccount(e.target.value)} required>
                  <option value="">Select account...</option>
                  {accounts.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Reference Number</Label>
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Cheque / Transaction No."
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Clearance Date</Label>
                <Input value={clearanceDate} onChange={(e) => setClearanceDate(e.target.value)} type="date" />
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">User Remark</Label>
              <Input
                value={userRemark}
                onChange={(e) => setUserRemark(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" asChild>
            <Link to="/payments">Cancel</Link>
          </Button>
          <Button type="submit">Save & Submit</Button>
        </div>
      </form>
    </div>
  )
}
