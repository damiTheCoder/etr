import React, { useEffect, useState } from 'react'
import { Plus, X, FolderPlus } from 'lucide-react'
import { api } from '@/utils/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NativeSelect } from '@/components/ui/native-select'

export default function Accounts() {
  const [accountTree, setAccountTree] = useState<any[]>([])
  const [filterRootType, setFilterRootType] = useState('all')

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newRootType, setNewRootType] = useState('Asset')
  const [newAccountNumber, setNewAccountNumber] = useState('')
  const [newParentAccount, setNewParentAccount] = useState('')
  const [newAccountType, setNewAccountType] = useState('')
  const [newIsGroup, setNewIsGroup] = useState(false)
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const rootTypes = [
    { value: 'Asset', label: 'Assets', natured: 'Debit' },
    { value: 'Liability', label: 'Liabilities', natured: 'Credit' },
    { value: 'Equity', label: 'Equity', natured: 'Credit' },
    { value: 'Income', label: 'Income', natured: 'Credit' },
    { value: 'Expense', label: 'Expenses', natured: 'Debit' },
  ]

  async function loadTree() {
    try {
      const tree = await api.getAccountTree()
      setAccountTree(tree || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadTree()
  }, [])

  function flattenTree(tree: any[], level = 0): any[] {
    const result: any[] = []
    for (const node of tree) {
      result.push({ ...node, level, debitNatured: node.rootType === 'Asset' || node.rootType === 'Expense' })
      if (node.children && node.children.length > 0) {
        result.push(...flattenTree(node.children, level + 1))
      }
    }
    return result
  }

  const allFlattenedNodes = flattenTree(accountTree)

  let filteredTree = accountTree
  if (filterRootType && filterRootType !== 'all') {
    filteredTree = accountTree.filter(n => n.rootType === filterRootType)
  }
  const flattenedNodes = flattenTree(filteredTree)

  const totalCount = flattenedNodes.length
  const groupCount = flattenedNodes.filter(n => n.isGroup).length
  const leafCount = flattenedNodes.filter(n => !n.isGroup).length

  function countByType(rootType: string) {
    return allFlattenedNodes.filter(n => n.rootType === rootType).length
  }

  function rootTypeBadge(rt: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      Asset: 'default',
      Liability: 'secondary',
      Equity: 'outline',
      Income: 'outline',
      Expense: 'destructive',
    }
    return map[rt] || 'secondary'
  }

  // Parent account candidates filtered by rootType
  const parentCandidates = allFlattenedNodes.filter(
    n => n.rootType === newRootType && n.isGroup
  )

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!newAccountName.trim()) {
      setErrorMsg('Account Name is required')
      return
    }
    try {
      setCreating(true)
      setErrorMsg('')
      await api.create('Account', {
        name: newAccountName.trim(),
        rootType: newRootType,
        accountNumber: newAccountNumber.trim() || undefined,
        parentAccount: newParentAccount || undefined,
        accountType: newAccountType.trim() || undefined,
        isGroup: newIsGroup,
      })

      // Success reset
      setShowCreateModal(false)
      setNewAccountName('')
      setNewAccountNumber('')
      setNewParentAccount('')
      setNewAccountType('')
      setNewIsGroup(false)
      await loadTree()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create account')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Chart of Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} accounts · {groupCount} groups · {leafCount} leaf accounts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NativeSelect value={filterRootType} onChange={(e) => setFilterRootType(e.target.value)} className="w-auto min-w-[180px]">
            <option value="all">All Types</option>
            <option value="Asset">Assets (Debit)</option>
            <option value="Liability">Liabilities (Credit)</option>
            <option value="Equity">Equity (Credit)</option>
            <option value="Income">Income (Credit)</option>
            <option value="Expense">Expenses (Debit)</option>
          </NativeSelect>
          <Button
            onClick={() => {
              setErrorMsg('')
              setShowCreateModal(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Create Account
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {rootTypes.map((rt) => (
          <Card key={rt.value}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center justify-between">
                {rt.label}
                <Badge variant={rt.natured === 'Debit' ? 'secondary' : 'outline'}>{rt.natured}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{countByType(rt.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Account</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Root Type</TableHead>
                  <TableHead>Account Type</TableHead>
                  <TableHead className="text-center">Nature</TableHead>
                  <TableHead className="text-center">Group</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flattenedNodes.map((node) => (
                  <TableRow key={node.name} className={node.isGroup ? 'bg-gray-50/50' : ''}>
                    <TableCell className="pl-6">
                      <span style={{ paddingLeft: `${node.level * 20}px` }} className="inline-block" />
                      <span className={node.isGroup ? 'font-semibold' : ''}>{node.name}</span>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-gray-500">{node.accountNumber || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={rootTypeBadge(node.rootType)}>{node.rootType}</Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">{node.accountType || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={node.debitNatured ? 'secondary' : 'outline'}>
                        {node.debitNatured ? 'Dr' : 'Cr'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {node.isGroup ? (
                        <span className="text-xs text-gray-500">Group</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {flattenedNodes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 py-12">
                      No accounts found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-900">Create New Account</h3>
                  <p className="text-xs text-slate-500">Add an account to your Chart of Accounts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg">
                  {errorMsg}
                </div>
              )}

              <div>
                <Label className="mb-1.5 block font-medium">Account Name <span className="text-red-500">*</span></Label>
                <Input
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g. Office Equipment, Marketing Expenses, Stripe Bank"
                  required
                  autoFocus
                />
              </div>

              <div>
                <Label className="mb-1.5 block font-medium">Root Type <span className="text-red-500">*</span></Label>
                <NativeSelect
                  value={newRootType}
                  onChange={(e) => {
                    setNewRootType(e.target.value)
                    setNewParentAccount('')
                  }}
                  required
                >
                  <option value="Asset">Asset (Assets — Debit Natured)</option>
                  <option value="Liability">Liability (Liabilities — Credit Natured)</option>
                  <option value="Equity">Equity (Equity — Credit Natured)</option>
                  <option value="Income">Income (Revenue / Sales — Credit Natured)</option>
                  <option value="Expense">Expense (Expenses / COGS — Debit Natured)</option>
                </NativeSelect>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block font-medium">Account Number (Optional)</Label>
                  <Input
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    placeholder="e.g. 1500, 5200"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block font-medium">Parent Group (Optional)</Label>
                  <NativeSelect
                    value={newParentAccount}
                    onChange={(e) => setNewParentAccount(e.target.value)}
                  >
                    <option value="">(Top level / No parent)</option>
                    {parentCandidates.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block font-medium">Account Type (Optional)</Label>
                <Input
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value)}
                  placeholder="e.g. Bank, Cash, Receivable, Payable, Expense Account"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isGroup"
                  checked={newIsGroup}
                  onChange={(e) => setNewIsGroup(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="isGroup" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Is Group Account (can contain sub-accounts)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700 text-white border border-black shadow-sm"
                >
                  {creating ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

