"use client"

import React from 'react'
import { TimeFramesEditor } from './time-frames-editor'

interface Props {
  payGuideId: string
}

export const OvertimeFramesEditor: React.FC<Props> = ({ payGuideId }) => {
  return <TimeFramesEditor variant="overtime" payGuideId={payGuideId} />
}

