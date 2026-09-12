import React, { useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NativeSelect } from '@/components/ui/native-select'

export default function Accounts() {
  const [accountTree, setAccountTree] = useState<any[]>([])
  const [filterRootType, setFilterRootType] = useState('all')

  const rootTypes = [
    { value: 'Asset', label: 'Assets', natured: 'Debit' },
    { value: 'Liability', label: 'Liabilities', natured: 'Credit' },
    { value: 'Equity', label: 'Equity', natured: 'Credit' },
    { value: 'Income', label: 'Income', natured: 'Credit' },
    { value: 'Expense', label: 'Expenses', natured: 'Debit' },
  ]

  useEffect(() => {
    async function loadTree() {
      try {
        const tree = await api.getAccountTree()
        setAccountTree(tree || [])
      } catch (e) {
        console.error(e)
      }
    }
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

  let filteredTree = accountTree
  if (filterRootType && filterRootType !== 'all') {
    filteredTree = accountTree.filter(n => n.rootType === filterRootType)
  }
  const flattenedNodes = flattenTree(filteredTree)

  const totalCount = flattenedNodes.length
  const groupCount = flattenedNodes.filter(n => n.isGroup).length
  const leafCount = flattenedNodes.filter(n => !n.isGroup).length

  function countByType(rootType: string) {
    return flattenedNodes.filter(n => n.rootType === rootType).length
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Chart of Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} accounts · {groupCount} groups · {leafCount} leaf accounts
          </p>
        </div>
        <div className="flex gap-2">
          <NativeSelect value={filterRootType} onChange={(e) => setFilterRootType(e.target.value)} className="w-auto min-w-[180px]">
            <option value="all">All Types</option>
            <option value="Asset">Assets (Debit)</option>
            <option value="Liability">Liabilities (Credit)</option>
            <option value="Equity">Equity (Credit)</option>
            <option value="Income">Income (Credit)</option>
            <option value="Expense">Expenses (Debit)</option>
          </NativeSelect>
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
    </div>
  )
}
