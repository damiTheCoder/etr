import React, { useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle, XCircle } from 'lucide-react'

export default function Approvals() {
  const [approvals, setApprovals] = useState<any[]>([])

  async function loadData() {
    try {
      const data = await api.list('Approval')
      setApprovals(data || [])
    } catch (e) {
      console.error('Failed to load approvals:', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleApprove(name: string) {
    try {
      await api.approveDoc(name)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to approve')
    }
  }

  async function handleReject(name: string) {
    try {
      await api.rejectDoc(name)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to reject')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">Manage document approval workflows</p>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Approval #</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((appr) => (
                <TableRow key={appr.name}>
                  <TableCell className="font-medium">{appr.name}</TableCell>
                  <TableCell className="text-gray-500">{appr.referenceName}</TableCell>
                  <TableCell className="text-gray-500">{appr.referenceType}</TableCell>
                  <TableCell className="text-gray-500">{appr.date}</TableCell>
                  <TableCell className="text-center">
                    {appr.status === 'Approved' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle className="w-3 h-3" /> Approved
                      </span>
                    ) : appr.status === 'Rejected' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                        <XCircle className="w-3 h-3" /> Rejected
                      </span>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {appr.status === 'Pending' || !appr.status ? (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApprove(appr.name)}>
                          Approve
                        </Button>
                        <Button variant="outline" size="sm" className="text-rose-600 border-rose-300 hover:bg-rose-50" onClick={() => handleReject(appr.name)}>
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">Completed</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {approvals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-12">
                    No approvals pending
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
