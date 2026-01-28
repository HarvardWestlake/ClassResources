import { Navigate, useParams } from 'react-router-dom'
import StaticEmbed from './StaticEmbed'
import type { WidgetInfo } from './widgetMaps'

type WidgetRouteProps = {
  widgets: Record<string, WidgetInfo>
  backTo: string
  backLabel: string
}

export default function WidgetRoute({ widgets, backTo, backLabel }: WidgetRouteProps) {
  const params = useParams()
  const key = String(params.widget || '')
  const w = widgets[key]

  if (!w) return <Navigate to={backTo} replace />

  return <StaticEmbed title={w.title} src={w.src} backTo={backTo} backLabel={backLabel} />
}

