'use client'

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  Terminal,
  XCircle,
} from 'lucide-react'
import { useBuilder } from '@/lib/builder-store'
import { issueCounts, type Issue, type IssueLevel } from '@/lib/validate'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LEVEL_META: Record<IssueLevel, { icon: typeof XCircle; className: string }> = {
  error: { icon: XCircle, className: 'text-destructive' },
  warning: { icon: AlertTriangle, className: 'text-warning' },
  info: { icon: Info, className: 'text-brand' },
}

function IssueRow({ issue, onJump }: { issue: Issue; onJump: (issue: Issue) => void }) {
  const { icon: Icon, className } = LEVEL_META[issue.level]
  const jumpable = Boolean(issue.nodeIds?.length)

  return (
    <li>
      <button
        type="button"
        onClick={() => jumpable && onJump(issue)}
        className={cn(
          'flex w-full items-start gap-2.5 px-4 py-2 text-left transition-colors',
          jumpable ? 'cursor-pointer hover:bg-secondary' : 'cursor-default',
        )}
      >
        <Icon className={cn('mt-0.5 size-3.5 shrink-0', className)} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">{issue.title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {issue.detail}
          </span>
        </span>
        {jumpable ? (
          <span className="tabular mt-0.5 shrink-0 text-[11px] text-tertiary">
            {issue.nodeIds!.length} node{issue.nodeIds!.length > 1 ? 's' : ''}
          </span>
        ) : null}
      </button>
    </li>
  )
}

export function ConsolePanel({ onJump }: { onJump: (issue: Issue) => void }) {
  const { consoleOpen, consoleTab, setConsole, issues, validated, log } = useBuilder()
  const counts = issueCounts(issues)

  return (
    <section
      aria-label="Validation console"
      className={cn(
        'flex shrink-0 flex-col border-t border-border bg-background transition-[height] duration-200',
        consoleOpen ? 'h-56' : 'h-9',
      )}
      style={{ transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
    >
      <div className="flex h-9 shrink-0 items-center gap-1 px-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setConsole(!consoleOpen)}
          aria-label={consoleOpen ? 'Collapse console' : 'Expand console'}
        >
          <ChevronDown className={cn('transition-transform', !consoleOpen && 'rotate-180')} />
        </Button>

        {(['issues', 'log'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setConsole(true, tab)}
            className={cn(
              'flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-[13px] capitalize transition-colors',
              consoleOpen && consoleTab === tab
                ? 'bg-secondary font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'issues' ? <AlertTriangle className="size-3.5" /> : <Terminal className="size-3.5" />}
            {tab}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3 pr-2 text-[11px]">
          {!validated ? (
            <span className="text-tertiary">Not validated</span>
          ) : counts.errors + counts.warnings + counts.infos === 0 ? (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="size-3" />
              Graph is valid
            </span>
          ) : (
            <>
              {counts.errors > 0 ? (
                <span className="tabular flex items-center gap-1 text-destructive">
                  <XCircle className="size-3" />
                  {counts.errors}
                </span>
              ) : null}
              {counts.warnings > 0 ? (
                <span className="tabular flex items-center gap-1 text-warning">
                  <AlertTriangle className="size-3" />
                  {counts.warnings}
                </span>
              ) : null}
              {counts.infos > 0 ? (
                <span className="tabular flex items-center gap-1 text-brand">
                  <Info className="size-3" />
                  {counts.infos}
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>

      {consoleOpen ? (
        <div className="no-scrollbar flex-1 overflow-y-auto border-t border-border">
          {consoleTab === 'issues' ? (
            !validated ? (
              <p className="px-4 py-6 text-center text-[13px] text-tertiary">
                Hit <span className="font-medium text-foreground">Validate</span> to check this
                graph for structural problems.
              </p>
            ) : issues.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
                <CheckCircle2 className="size-5 text-success" />
                <p className="text-[13px] font-medium">No problems found</p>
                <p className="text-xs text-tertiary">
                  Every node is configured, wired and within your plan limits.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {issues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} onJump={onJump} />
                ))}
              </ul>
            )
          ) : (
            <ul className="flex flex-col-reverse px-4 py-2">
              {log.map((entry) => (
                <li key={entry.id} className="flex gap-3 py-1 font-mono text-[11px]">
                  <span className="tabular shrink-0 text-tertiary">
                    {new Date(entry.at).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 uppercase',
                      entry.level === 'error'
                        ? 'text-destructive'
                        : entry.level === 'warn'
                          ? 'text-warning'
                          : 'text-tertiary',
                    )}
                  >
                    {entry.level}
                  </span>
                  <span className="min-w-0 flex-1 text-muted-foreground">{entry.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
