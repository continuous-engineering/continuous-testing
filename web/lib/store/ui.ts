'use client'
import { create } from 'zustand'

type UiState = {
  // Active project/pipeline selection
  activeProjectId:  string | null
  activePipelineId: string | null
  setActiveProject:  (id: string | null) => void
  setActivePipeline: (id: string | null) => void

  // Pipeline canvas
  dagViewEnabled: boolean
  toggleDagView:  () => void

  // Run panel
  activeRunId: string | null
  setActiveRunId: (id: string | null) => void

  // Step editor drawer
  editingStepId: string | null
  openStepEditor: (stepId: string) => void
  closeStepEditor: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activeProjectId:  null,
  activePipelineId: null,
  setActiveProject:  (id) => set({ activeProjectId: id }),
  setActivePipeline: (id) => set({ activePipelineId: id }),

  dagViewEnabled: false,
  toggleDagView:  () => set((s) => ({ dagViewEnabled: !s.dagViewEnabled })),

  activeRunId: null,
  setActiveRunId: (id) => set({ activeRunId: id }),

  editingStepId: null,
  openStepEditor:  (stepId) => set({ editingStepId: stepId }),
  closeStepEditor: ()       => set({ editingStepId: null }),
}))
