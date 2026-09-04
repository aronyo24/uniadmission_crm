import { ActivityTimeline } from "@/components/crm/ActivityTimeline"

export default function CommunicationsList() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Communications</h1>
        <p className="text-sm text-muted-foreground">All outreach and activity across every student.</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <ActivityTimeline limit={50} />
      </div>
    </div>
  )
}
