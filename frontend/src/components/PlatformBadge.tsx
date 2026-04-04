import Badge, { platformVariant } from './ui/Badge'

export default function PlatformBadge({ platform }: { platform: string }) {
  return <Badge variant={platformVariant(platform)} dot>{platform}</Badge>
}
