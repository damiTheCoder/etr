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

export default function PartyForm() {
  const navigate = useNavigate()
  const { name } = useParams()
  const isEdit = !!name

  const [loading, setLoading] = useState(true)
  const [partyName, setPartyName] = useState('')
  const [partyType, setPartyType] = useState('Customer')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [taxId, setTaxId] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    async function loadParty() {
      if (isEdit && name) {
        try {
          const doc = await api.get('Party', name)
          setPartyName(doc.name || '')
          setPartyType(doc.partyType || 'Customer')
          setEmail(doc.email || '')
          setPhone(doc.phone || '')
          setTaxId(doc.taxId || '')
          setAddress(doc.address || '')
        } catch (e: any) {
          alert(e.message)
          navigate('/parties')
        }
      }
      setLoading(false)
    }
    loadParty()
  }, [isEdit, name, navigate])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        name: partyName,
        partyType,
        email,
        phone,
        taxId,
        address,
      }
      if (isEdit && name) {
        await api.update('Party', name, data)
      } else {
        await api.create('Party', data)
      }
      navigate('/parties')
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
        <Link to="/parties" className="shrink-0 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Party' : 'New Party'}</h1>
      </div>

      <form onSubmit={save} className="space-y-6 w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Party Information</CardTitle>
            <CardDescription>{isEdit ? 'Update party details' : 'Add a new customer or supplier'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Name</Label>
              <Input
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                required
                disabled={isEdit}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Type</Label>
              <NativeSelect value={partyType} onChange={(e) => setPartyType(e.target.value)} required>
                <option value="Customer">Customer</option>
                <option value="Supplier">Supplier</option>
                <option value="Both">Both</option>
              </NativeSelect>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </div>
              <div>
                <Label className="mb-1.5 block">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Tax ID</Label>
              <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Address</Label>
              <Textarea
                rows={3}
                placeholder="Enter party address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" asChild>
            <Link to="/parties">Cancel</Link>
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  )
}
