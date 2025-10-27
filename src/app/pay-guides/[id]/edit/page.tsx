'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { PayGuideForm, PenaltyFramesEditor, OvertimeFramesEditor } from '@/components/pay-guides'

type Params = { id: string }

export default function EditPayGuidePage() {
  const params = useParams<Params>()
  const id = (params?.id ?? '') as string
  return (
    <AppShell title="Edit Pay Guide" subtitle="Modify fields and rules" showBackButton backButtonHref="/pay-guides">
      <div className="d-flex flex-column gap-4">
        <PayGuideForm mode="edit" payGuideId={id} />
        <PenaltyFramesEditor payGuideId={id} />
        <OvertimeFramesEditor payGuideId={id} />
      </div>
    </AppShell>
  )
}
