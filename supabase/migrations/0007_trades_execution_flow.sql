-- Migration: 0007_trades_execution_flow.sql
-- Description: Add execution_flow jsonb column to public.trades for backtest node-by-node telemetry.

alter table public.trades add column if not exists execution_flow jsonb;
