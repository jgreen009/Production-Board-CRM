import type { Priority } from '@/types'

const PRIORITY_ORDER: Record<Priority, number> = {
  Urgent: 0,
  High: 1,
  Normal: 2,
}

export function priorityRank(p: Priority): number {
  return PRIORITY_ORDER[p]
}

export function sortByPriority<T extends { priority: Priority }>(items: T[]): T[] {
  return [...items].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
}

export function sortByDueDate<T extends { dueDate: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  )
}
