'use client'

import React, { useState } from 'react'
import { AppShell } from '@/components/layout'
import { CoefficientsEditor, StslEditor } from '@/components/tax-admin'
import '@/components/tax-admin/tax-admin.scss'

export default function TaxTablesPage() {
  const [tab, setTab] = useState<'coeff' | 'stsl'>('coeff')
  return (
    <AppShell title="Tax Tables" subtitle="Update PAYG and STSL (Schedule 8)" showBackButton backButtonHref="/settings">
      <div className="tax-admin">
        <div className="tax-admin__tabs" role="tablist" aria-label="Tax tables">
          <button role="tab" aria-selected={tab === 'coeff'} className={`tax-admin__tab ${tab === 'coeff' ? 'tax-admin__tab--active' : ''}`} onClick={() => setTab('coeff')}>PAYG Coefficients</button>
          <button role="tab" aria-selected={tab === 'stsl'} className={`tax-admin__tab ${tab === 'stsl' ? 'tax-admin__tab--active' : ''}`} onClick={() => setTab('stsl')}>STSL Coefficients</button>
        </div>
        {tab === 'coeff' ? <CoefficientsEditor /> : <StslEditor />}
      </div>
    </AppShell>
  )
}
