import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Plus, RotateCcw, Save, CheckCircle, Clock, History } from 'lucide-react'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AccountSelect } from '@/components/ui/select'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

import { useCompany } from '@/context/CompanyContext'

export default function JournalEntryForm() {
  const { formatCurrency } = useCompany()
  const navigate = useNavigate()
  const { name } = useParams()
  const isEdit = !!name

  const [accounts, setAccounts] = useState<any[]>([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [entryType, setEntryType] = useState('Journal Entry')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [userRemark, setUserRemark] = useState('')
  const [lines, setLines] = useState<any[]>([])
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [status, setStatus] = useState('Draft')
  const [loading, setLoading] = useState(false)
  const [auditLogs, setAuditLogs] = useState<any[]>([])

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

  async function refreshAuditLogs() {
    if (!name) return
    try {
      const logs = await api.getAuditLogs('JournalEntry', name)
      setAuditLogs(logs || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    async function loadEntry() {
      if (!name) return
      try {
        setLoading(true)
        const doc = await api.get('JournalEntry', name)
        if (doc) {
          setDate(doc.date || new Date().toISOString().split('T')[0])
          setEntryType(doc.entryType || 'Journal Entry')
          setReferenceNumber(doc.referenceNumber || '')
          setUserRemark(doc.userRemark || '')
          setLines(doc.accounts || [])
          const submitted = !!doc.submitted && !doc.cancelled
          setIsSubmitted(submitted)
          if (doc.cancelled) setStatus('Cancelled')
          else if (doc.submitted) setStatus('Submitted')
          else setStatus('Draft')
        }
        await refreshAuditLogs()
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadEntry()
  }, [name])

  function addLine() {
    if (isSubmitted) return
    setLines([...lines, { account: '', debit: 0, credit: 0, description: '' }])
  }

  function removeLine(index: number) {
    if (isSubmitted) return
    const updated = [...lines]
    updated.splice(index, 1)
    setLines(updated)
  }

  function handleAccountChange(index: number, value: string) {
    if (isSubmitted) return
    const updated = [...lines]
    updated[index].account = value
    setLines(updated)
  }

  function handleDescChange(index: number, value: string) {
    if (isSubmitted) return
    const updated = [...lines]
    updated[index].description = value
    setLines(updated)
  }

  function handleDebitChange(index: number, debit: number) {
    if (isSubmitted) return
    const updated = [...lines]
    updated[index].debit = debit
    setLines(updated)
  }

  function handleCreditChange(index: number, credit: number) {
    if (isSubmitted) return
    const updated = [...lines]
    updated[index].credit = credit
    setLines(updated)
  }

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  async function handleResetToDraft() {
    if (!name) return
    if (!confirm('Are you sure you want to reset this entry to Draft? All ledger postings will be reverted so you can edit the entry.')) {
      return
    }
    try {
      setLoading(true)
      await api.resetToDraft('JournalEntry', name)
      setIsSubmitted(false)
      setStatus('Draft')
    } catch (err: any) {
      alert(err.message || 'Failed to reset entry to draft')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveDraft() {
    if (!isBalanced) {
      alert('Debits must equal credits')
      return
    }
    try {
      setLoading(true)
      const data = {
        date,
        entryType,
        referenceNumber,
        userRemark,
        numberSeries: 'JE-',
        accounts: lines,
      }
      if (isEdit && name) {
        await api.update('JournalEntry', name, data)
      } else {
        await api.create('JournalEntry', data)
      }
      navigate('/journal-entries')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAndSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isBalanced) {
      alert('Debits must equal credits')
      return
    }
    try {
      setLoading(true)
      const data = {
        date,
        entryType,
        referenceNumber,
        userRemark,
        numberSeries: 'JE-',
        accounts: lines,
      }
      let docName = name
      if (isEdit && name) {
        await api.update('JournalEntry', name, data)
      } else {
        const res = await api.create('JournalEntry', data)
        docName = res.name
      }
      if (docName) {
        await api.submit('JournalEntry', docName)
      }
      navigate('/journal-entries')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link to="/journal-entries" className="shrink-0 text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {isEdit ? `Journal Entry: ${name}` : 'New Journal Entry'}
              </h1>
              {isEdit && (
                <Badge variant={isSubmitted ? 'default' : status === 'Cancelled' ? 'destructive' : 'secondary'}>
                  {status}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSubmitted ? 'This entry is posted. Click "Reset to Draft" to enable editing.' : 'Fill in entry details and accounting lines below'}
            </p>
          </div>
        </div>

        {isSubmitted && (
          <Button
            type="button"
            onClick={handleResetToDraft}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black shadow-sm flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Reset to Draft
          </Button>
        )}
      </div>

      {isSubmitted && (
        <div className="mb-6 p-4 bg-blue-50/80 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3 text-blue-900 text-sm">
            <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" />
            <span>This journal entry is posted and locked. Click <strong>Reset to Draft</strong> to unlock and edit all fields.</span>
          </div>
          <Button
            type="button"
            onClick={handleResetToDraft}
            disabled={loading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset to Draft
          </Button>
        </div>
      )}

      <form onSubmit={handleSaveAndSubmit} className="space-y-6 w-full max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Entry Details</CardTitle>
            <CardDescription>General information for this journal entry</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="mb-1.5 block">Date</Label>
                <Input
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  type="date"
                  disabled={isSubmitted}
                  required
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Entry Type</Label>
                <NativeSelect
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value)}
                  disabled={isSubmitted}
                >
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
                  disabled={isSubmitted}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">User Remark</Label>
              <Input
                value={userRemark}
                onChange={(e) => setUserRemark(e.target.value)}
                placeholder="Description..."
                disabled={isSubmitted}
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
            {!isSubmitted && (
              <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                <Plus className="w-4 h-4 mr-1" /> Add Line
              </Button>
            )}
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
                      {!isSubmitted && <TableHead className="w-[40px]"></TableHead>}
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
                            disabled={isSubmitted}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.description || ''}
                            onChange={(e) => handleDescChange(i, e.target.value)}
                            placeholder="Memo..."
                            disabled={isSubmitted}
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
                            disabled={isSubmitted}
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
                            disabled={isSubmitted}
                          />
                        </TableCell>
                        {!isSubmitted && (
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => removeLine(i)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        )}
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
            <Link to="/journal-entries">Back to List</Link>
          </Button>
          {!isSubmitted && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={loading || !isBalanced || lines.length === 0}
                className="flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Save Draft
              </Button>
              <Button
                type="submit"
                disabled={loading || !isBalanced || lines.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white border border-black cursor-pointer"
              >
                Post Entry
              </Button>
            </>
          )}
        </div>
      </form>

      {isEdit && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-900">
              <Clock className="w-4 h-4 text-blue-600" /> Audit Trail & Edit Logs
            </CardTitle>
            <CardDescription>
              Complete history of modifications, status resets, and ledger postings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {auditLogs.length > 0 ? (
              <div className="space-y-3">
                {auditLogs.map((log, i) => (
                  <div
                    key={log.id || i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100/70 text-blue-700 rounded-lg shrink-0">
                        <History className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{log.action}</span>
                          <Badge
                            variant={
                              log.action === 'Posted'
                                ? 'default'
                                : log.action === 'Reset to Draft'
                                ? 'secondary'
                                : log.action === 'Cancelled'
                                ? 'destructive'
                                : 'outline'
                            }
                          >
                            {log.action}
                          </Badge>
                        </div>
                        {log.details && (
                          <p className="text-xs text-slate-600 mt-0.5">{log.details}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-xs font-mono font-medium text-slate-500">
                        {formatTimestamp(log.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-6 text-sm">
                No audit logs recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatTimestamp(ts: string) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ts
  }
}

