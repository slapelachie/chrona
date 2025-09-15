'use client'

import React, { useState } from 'react'
import { AppShell } from '@/components/layout'
import { CoefficientsEditor, HecsEditor } from '@/components/tax-admin'
import '@/components/tax-admin/tax-admin.scss'

export default function TaxTablesPage() {
  const [tab, setTab] = useState<'coeff' | 'hecs'>('coeff')
  return (
    <AppShell title="Tax Tables" subtitle="Update PAYG scales and HECS thresholds" showBackButton backButtonHref="/settings">
      <div className="tax-admin">
        <div className="tax-admin__tabs" role="tablist" aria-label="Tax tables">
          <button role="tab" aria-selected={tab === 'coeff'} className={`tax-admin__tab ${tab === 'coeff' ? 'tax-admin__tab--active' : ''}`} onClick={() => setTab('coeff')}>PAYG Coefficients</button>
          <button role="tab" aria-selected={tab === 'hecs'} className={`tax-admin__tab ${tab === 'hecs' ? 'tax-admin__tab--active' : ''}`} onClick={() => setTab('hecs')}>HECS Thresholds</button>
        </div>
        {tab === 'coeff' ? <CoefficientsEditor /> : <HecsEditor />}
      </div>
    </AppShell>
  )
}
