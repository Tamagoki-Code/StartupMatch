-- Thesis dataflow spec: "Live Activity and Status Indicators" — a heartbeat
-- marks a user active while using the platform; the UI derives "offline"
-- from how long ago that heartbeat last landed, rather than needing a
-- separate explicit offline signal (which tab-close/navigation can't
-- reliably fire anyway).
alter table profiles add column if not exists last_seen_at timestamptz;
