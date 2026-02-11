/**
 * Priority Calculation Utilities for Kanban Board
 * Calculates visual priority indicators based on sub-process age
 */

// Priority level types
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical'

// Complete priority configuration for a given level
export interface PriorityConfig {
  level: PriorityLevel
  color: string
  borderColor: string
  badgeClass: string
  showIcon: boolean
  label: string
  days: number
}

// Configurable thresholds in days
export interface PriorityThresholds {
  medium: number  // days to reach medium priority
  high: number    // days to reach high priority
  critical: number // days to reach critical priority
}

// Default thresholds (configurable by SUPER_ADMIN in future)
export const DEFAULT_THRESHOLDS: PriorityThresholds = {
  medium: 3,   // Yellow after 3 days
  high: 7,     // Orange after 7 days
  critical: 14, // Red after 14 days
}

/**
 * Calculate priority level and visual configuration based on creation date
 * @param createdAt - Date when the sub-process was created
 * @param thresholds - Optional custom thresholds (defaults to DEFAULT_THRESHOLDS)
 * @returns Complete priority configuration including colors, labels, and icon visibility
 */
export function calculatePriority(
  createdAt: Date,
  thresholds: PriorityThresholds = DEFAULT_THRESHOLDS
): PriorityConfig {
  const now = new Date()
  const diffMs = now.getTime() - new Date(createdAt).getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Critical priority (14+ days by default)
  if (days >= thresholds.critical) {
    return {
      level: 'critical',
      color: 'border-red-500',
      borderColor: 'border-l-4 border-red-500',
      badgeClass: 'bg-red-100 text-red-700 border-red-300',
      showIcon: true,
      label: formatDaysLabel(days),
      days,
    }
  }

  // High priority (7-13 days by default)
  if (days >= thresholds.high) {
    return {
      level: 'high',
      color: 'border-orange-500',
      borderColor: 'border-l-4 border-orange-500',
      badgeClass: 'bg-orange-100 text-orange-700 border-orange-300',
      showIcon: true,
      label: formatDaysLabel(days),
      days,
    }
  }

  // Medium priority (3-6 days by default)
  if (days >= thresholds.medium) {
    return {
      level: 'medium',
      color: 'border-yellow-500',
      borderColor: 'border-l-4 border-yellow-500',
      badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      showIcon: false,
      label: formatDaysLabel(days),
      days,
    }
  }

  // Low priority (0-2 days by default)
  return {
    level: 'low',
    color: 'border-gray-200',
    borderColor: '',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-300',
    showIcon: false,
    label: formatDaysLabel(days),
    days,
  }
}

/**
 * Format days into human-readable label
 * @param days - Number of days elapsed
 * @returns Formatted string like "Hoy", "Ayer", "Hace 3 días"
 */
function formatDaysLabel(days: number): string {
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}
