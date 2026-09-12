import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Plus } from 'lucide-react'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AccountSelect } from '@/components/ui/select'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function JournalEntryForm() {
  const navigate = useNavigate()
  const { name } = useParams()
  const isEdit = !!name

  const [accounts, setAccounts] = useState<any[]>([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [entryType, setEntryType] = useState('Journal Entry')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [userRemark, setUserRemark] = useState('')
  const [lines, setLines] = useState<any[]>([])

  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await api.list('Account', 1000)
        setAccounts(res.filter((a: any) => !a.isGroup))
      } catch (e) {
        console.error(e)
      }
    }
    loadAccounts()
  }, [])

  function addLine() {
    setLines([...lines, { account: '', debit: 0, credit: 0, description: '' }])
  }

  function removeLine(index: number) {
    const updated = [...lines]
    updated.splice(index, 1)
    setLines(updated)
  }

  function handleAccountChange(index: number, value: string) {
    const updated = [...lines]
    updated[index].account = value
    setLines(updated)
  }

  function handleDescChange(index: number, value: string) {
    const updated = [...lines]
    updated[index].description = value
    setLines(updated)
  }

  function handleDebitChange(index: number, debit: number) {
    const updated = [...lines]
    updated[index].debit = debit
    setLines(updated)
  }

  function handleCreditChange(index: number, credit: number) {
    const updated = [...lines]
    updated[index].credit = credit
    setLines(updated)
  }

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  function formatCurrency(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!isBalanced) {
      alert('Debits must equal credits')
      return
    }
    try {
      const data = {
        date,
        entryType,
        referenceNumber,
        userRemark,
        numberSeries: 'JE-',
        accounts: lines,
      }
      const res = await api.create('JournalEntry', data)
      await api.submit('JournalEntry', res.name)
      navigate('/journal-entries')
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <Link to="/journal-entries" className="shrink-0 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Journal Entry' : 'New Journal Entry'}</h1>
      </div>

      <form onSubmit={save} className="space-y-6 w-full max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Entry Details</CardTitle>
            <CardDescription>General information for this journal entry</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="mb-1.5 block">Date</Label>
                <Input value={date} onChange={(e) => setDate(e.target.value)} type="date" required />
              </div>
              <div>
                <Label className="mb-1.5 block">Entry Type</Label>
                <NativeSelect value={entryType} onChange={(e) => setEntryType(e.target.value)}>
                  <option value="Journal Entry">Journal Entry</option>
                  <option value="Opening Entry">Opening Entry</option>
                  <option value="Depreciation Entry">Depreciation Entry</option>
                  <option value="Adjustment Entry">Adjustment Entry</option>
                  <option value="Closing Entry">Closing Entry</option>
                  <option value="Reversal Entry">Reversal Entry</option>
                  <option value="Write Off Entry">Write Off Entry</option>
                  <option value="Bank Reconciliation">Bank Reconciliation</option>
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Reference Number</Label>
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Cheque / Doc No."
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">User Remark</Label>
              <Input
                value={userRemark}
                onChange={(e) => setUserRemark(e.target.value)}
                placeholder="Description..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Accounting Entries</CardTitle>
              <CardDescription>Add debit and credit lines (debits must equal credits)</CardDescription>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addLine}>
              <Plus className="w-4 h-4 mr-1" /> Add Line
            </Button>
          </CardHeader>
          <CardContent>
            {lines.length > 0 ? (
              <div className="table-scroll rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Account</TableHead>
                      <TableHead className="w-[30%]">Description</TableHead>
                      <TableHead className="w-[100px] text-right">Debit</TableHead>
                      <TableHead className="w-[100px] text-right">Credit</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <AccountSelect
                            accounts={accounts}
                            value={line.account}
                            onChange={(val) => handleAccountChange(i, val)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.description || ''}
                            onChange={(e) => handleDescChange(i, e.target.value)}
                            placeholder="Memo..."
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="text-right"
                            value={line.debit}
                            onChange={(e) => handleDebitChange(i, parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="text-right"
                            value={line.credit}
                            onChange={(e) => handleCreditChange(i, parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => removeLine(i)}>
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
                No accounting lines. Click "Add Line" to get started.
              </div>
            )}

            {lines.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Debit</p>
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(totalDebit)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Credit</p>
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(totalCredit)}</p>
                  </div>
                </div>
                <span
                  className={`text-sm px-3.5 py-1 rounded-md font-semibold ${
                    isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {isBalanced ? '✓ Balanced' : `⚠ Difference: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" asChild>
            <Link to="/journal-entries">Cancel</Link>
          </Button>
          <Button type="submit" disabled={!isBalanced || lines.length === 0}>
            Save & Submit
          </Button>
        </div>
      </form>
    </div>
  )
}
