-- Headband color per player (video ID). Run once.
alter table players add column if not exists headband text not null default '';
