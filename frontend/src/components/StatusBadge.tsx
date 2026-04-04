import Badge, { statusVariant } from './ui/Badge'

export default function StatusBadge({ status }: { status: string }) {
  const label = status === 'manual_apply_needed' ? 'manual apply' : status
  return <Badge variant={statusVariant(status)}>{label}</Badge>
}
