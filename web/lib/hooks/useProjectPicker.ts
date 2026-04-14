'use client'
import { useEffect, useState } from 'react'

type Project = { id: string; name: string; slug: string }

const LS_KEY = 'ct_active_project_id'

export function useProjectPicker() {
  const [projects, setProjects]         = useState<Project[]>([])
  const [projectId, setProjectIdState]  = useState<string>('')
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d: { data: Project[] }) => {
        const list = d.data ?? []
        setProjects(list)
        // Restore from localStorage, fallback to first project
        const saved = localStorage.getItem(LS_KEY) ?? ''
        const valid = list.find((p) => p.id === saved)
        const active = valid ? saved : (list[0]?.id ?? '')
        setProjectIdState(active)
        if (active) localStorage.setItem(LS_KEY, active)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function setProjectId(id: string) {
    setProjectIdState(id)
    localStorage.setItem(LS_KEY, id)
  }

  return { projectId, setProjectId, projects, loading }
}
