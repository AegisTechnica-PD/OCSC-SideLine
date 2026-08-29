-- Adds a per-game formation. Run once.
alter table games add column if not exists formation text not null default '3-4-1';
