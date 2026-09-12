import React, { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check, X, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export interface AccountOption {
  name: string
  accountNumber?: string
  rootType?: string
  accountType?: string
  isGroup?: boolean
}

export interface AccountSelectProps {
  accounts: AccountOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = 'Select account...',
  className,
  disabled = false,
}: AccountSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter accounts excluding groups if desired, and matching search query
  const filteredAccounts = accounts.filter((a) => {
    if (a.isGroup) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const matchName = a.name.toLowerCase().includes(q)
    const matchNumber = a.accountNumber?.toLowerCase().includes(q)
    const matchRoot = a.rootType?.toLowerCase().includes(q)
    const matchType = a.accountType?.toLowerCase().includes(q)
    return matchName || matchNumber || matchRoot || matchType
  })

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    } else {
      setSearchQuery('')
    }
  }, [open])

  const selectedOption = accounts.find((a) => a.name === value)

  function getRootBadgeColor(rootType?: string) {
    switch (rootType) {
      case 'Asset':
        return 'bg-blue-100/80 text-blue-800 border-blue-300/60'
      case 'Liability':
        return 'bg-amber-100/80 text-amber-800 border-amber-300/60'
      case 'Equity':
        return 'bg-purple-100/80 text-purple-800 border-purple-300/60'
      case 'Income':
        return 'bg-emerald-100/80 text-emerald-800 border-emerald-300/60'
      case 'Expense':
        return 'bg-rose-100/80 text-rose-800 border-rose-300/60'
      default:
        return 'bg-slate-300/80 text-slate-700 border-slate-300/60'
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-xs transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 text-left',
          className
        )}
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="flex items-center gap-1.5">
              {selectedOption.accountNumber && (
                <span className="font-mono text-xs text-slate-400 font-semibold">
                  {selectedOption.accountNumber}
                </span>
              )}
              <span className="font-medium text-slate-900">{selectedOption.name}</span>
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 ml-2" />
      </button>

      {/* Account Selection Modal Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:w-full sm:max-w-xl max-h-[85vh] flex flex-col p-6 gap-4 bg-slate-100 border-0 shadow-2xl rounded-2xl">
          <DialogHeader className="bg-transparent">
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-lg font-semibold bg-transparent">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Select Account
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-xs bg-transparent">
              Choose an account from your Chart of Accounts or search by name, number, or category.
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar Input */}
          <div className="relative bg-transparent">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              className="w-full rounded-xl border-0 bg-slate-200/80 pl-9 pr-9 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs transition-all"
              placeholder="Search by account name, code (e.g. 1000), or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-700 bg-transparent"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Account Options List */}
          <div className="flex-1 max-h-[50vh] overflow-y-auto no-scrollbar space-y-1 pr-1 border-0 rounded-xl p-1.5 bg-slate-200/60">
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((acct) => {
                const isSelected = acct.name === value
                return (
                  <button
                    key={acct.name}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all cursor-pointer border-0',
                      isSelected
                        ? 'bg-blue-100/90 font-semibold text-slate-900 shadow-xs'
                        : 'bg-slate-200/50 hover:bg-slate-200/90 text-slate-800'
                    )}
                    onClick={() => {
                      onChange(acct.name)
                      setOpen(false)
                    }}
                  >
                    <div className="flex flex-col min-w-0 pr-3 bg-transparent">
                      <div className="flex items-center gap-2 truncate bg-transparent">
                        {acct.accountNumber && (
                          <span className="font-mono text-xs font-semibold text-slate-600 shrink-0 bg-slate-300/70 px-1.5 py-0.5 rounded">
                            {acct.accountNumber}
                          </span>
                        )}
                        <span className="truncate text-slate-900 text-sm font-medium bg-transparent">{acct.name}</span>
                      </div>
                      {acct.accountType && (
                        <span className="text-xs text-slate-500 mt-0.5 truncate bg-transparent">{acct.accountType}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 bg-transparent">
                      {acct.rootType && (
                        <span
                          className={cn(
                            'text-[11px] font-medium px-2 py-0.5 rounded-md border',
                            getRootBadgeColor(acct.rootType)
                          )}
                        >
                          {acct.rootType}
                        </span>
                      )}
                      {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="py-10 text-center text-sm text-slate-500 bg-transparent">
                No accounts match "{searchQuery}"
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
