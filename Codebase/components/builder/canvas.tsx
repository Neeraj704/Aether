'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { COMPONENT_MAP, LAYERS, LAYER_MAP } from '@/mock/layers'
import { hasComponent } from '@/lib/entitlements'
import { useSession } from '@/lib/store'
import {
  CANVAS_HEIGHT,
  LANE_H,
  NODE_H,
  NODE_W,
  computeLanes,
  useBuilder,
} from '@/lib/builder-store'
import { canConnect } from '@/lib/validate'
import { cn } from '@/lib/utils'
import { NodeCard, type NodeCardData } from './node-card'
import { StickyNote } from './sticky-note'
import { FrameBox } from './frame-box'
import { CanvasContextMenu } from './canvas-context-menu'
import { ViewportHud } from './viewport-hud'

const nodeTypes = { component: NodeCard, note: StickyNote, frame: FrameBox }

const GRID_VARIANT: Record<string, BackgroundVariant | null> = {
  dots: BackgroundVariant.Dots,
  lines: BackgroundVariant.Lines,
  off: null,
}

function LaneGuides() {
  const lanes = useMemo(computeLanes, [])
  const { collapsedLayers, toggleLayer } = useBuilder()

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {lanes.map((lane) => {
        const meta = LAYER_MAP[lane.layer]
        const collapsed = collapsedLayers.includes(lane.layer)
        return (
          <div
            key={lane.layer}
            className="absolute left-0 flex w-[100000px] items-stretch"
            style={{ top: lane.top, height: lane.height }}
          >
            <div
              className="absolute inset-0 transition-opacity duration-300"
              style={{
                background: `linear-gradient(90deg, color-mix(in oklab, ${meta.hue} 4%, transparent) 0%, transparent 60%)`,
                borderTop: '1px stroke color-mix(in oklab, var(--foreground) 5%, transparent)',
              }}
            />
            <button
              type="button"
              onClick={() => toggleLayer(lane.layer)}
              className={cn(
                'pointer-events-auto absolute top-3 left-4 flex items-center gap-2 rounded-[var(--radius-pill)] border border-border/60 px-2.5 py-1 text-left backdrop-blur-md transition-all hover:scale-105',
                collapsed ? 'bg-secondary' : 'bg-background/70 hover:bg-secondary',
              )}
            >
              <span
                className="tabular text-[9.5px] font-bold tracking-[0.1em]"
                style={{ color: meta.hue }}
              >
                {meta.roman}
              </span>
              <span className="text-[10.5px] font-medium tracking-[0.02em] text-muted-foreground">
                {meta.name}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

function FlowCanvas({
  onRequestUnlock,
}: {
  onRequestUnlock: (componentId: string) => void
}) {
  const {
    nodes,
    edges,
    notes,
    frames,
    selection,
    selectedEdges,
    tool,
    view,
    collapsedLayers,
    focusToken,
    addNode,
    moveNodes,
    moveNote,
    setSelection,
    setSelectedEdges,
    connect,
    paste,
    addNote,
    addFrame,
    nudgeSelection,
    removeNodes,
    duplicateSelection,
    copySelection,
    selectAll,
    undo,
    redo,
    disconnect,
  } = useBuilder()

  const { plan, unlocked } = useSession()
  const flow = useReactFlow()
  const wrapper = useRef<HTMLDivElement>(null)
  const [instance, setInstance] = useState<ReactFlowInstance | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null)

  const hiddenLayers = useMemo(() => new Set(collapsedLayers), [collapsedLayers])

  /** Converts a pointer event into canvas coordinates. */
  const toCanvas = useCallback(
    (clientX: number, clientY: number) => flow.screenToFlowPosition({ x: clientX, y: clientY }),
    [flow],
  )

  /* ---------------- Graph → React Flow ---------------- */

  const rfNodes = useMemo<Node[]>(() => {
    const frameNodes: Node[] = frames.map((f) => ({
      id: f.id,
      type: 'frame',
      position: { x: f.x, y: f.y },
      data: { ...f },
      draggable: tool === 'select',
      selectable: false,
      zIndex: -1,
    }))

    const componentNodes: Node[] = nodes
      .filter((n) => {
        const comp = COMPONENT_MAP[n.componentId]
        return comp ? !hiddenLayers.has(comp.layer) : true
      })
      .map((n) => {
        const comp = COMPONENT_MAP[n.componentId]
        const locked = comp ? !hasComponent(comp.id, { plan, unlocked }) : false
        const source = connectingFrom ? nodes.find((x) => x.id === connectingFrom) : null
        const candidate =
          source && source.id !== n.id ? canConnect(source, n).ok : undefined

        return {
          id: n.id,
          type: 'component',
          position: { x: n.x, y: n.y },
          selected: selection.includes(n.id),
          draggable: tool === 'select',
          data: {
            componentId: n.componentId,
            enabled: n.enabled,
            needsConfig: n.needsConfig,
            locked,
            candidate: candidate === true,
            blocked: candidate === false,
          } satisfies NodeCardData,
        }
      })

    const noteNodes: Node[] = notes.map((nt) => ({
      id: nt.id,
      type: 'note',
      position: { x: nt.x, y: nt.y },
      data: { ...nt },
      draggable: tool === 'select',
      selectable: false,
      zIndex: 20,
    }))

    return [...frameNodes, ...componentNodes, ...noteNodes]
  }, [
    frames,
    nodes,
    notes,
    selection,
    tool,
    hiddenLayers,
    plan,
    unlocked,
    connectingFrom,
  ])

  const rfEdges = useMemo<Edge[]>(
    () =>
      edges
        .filter((e) => {
          const s = nodes.find((n) => n.id === e.source)
          const t = nodes.find((n) => n.id === e.target)
          if (!s || !t) return false
          const sl = COMPONENT_MAP[s.componentId]?.layer
          const tl = COMPONENT_MAP[t.componentId]?.layer
          return !(sl && hiddenLayers.has(sl)) && !(tl && hiddenLayers.has(tl))
        })
        .map((e) => {
          const active = selectedEdges.includes(e.id)
          const touching = selection.includes(e.source) || selection.includes(e.target)
          const source = nodes.find((n) => n.id === e.source)
          const hue = source
            ? LAYER_MAP[COMPONENT_MAP[source.componentId]?.layer ?? 'data'].hue
            : 'var(--brand)'
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            type:
              view.edgeKind === 'bezier'
                ? 'default'
                : view.edgeKind === 'straight'
                  ? 'straight'
                  : 'smoothstep',
            animated: view.animateEdges && (touching || active),
            selected: active,
            style: {
              stroke: active ? 'var(--brand)' : hue,
              strokeWidth: active ? 2.25 : touching ? 1.9 : 1.4,
              opacity: active || touching ? 1 : 0.5,
            },
          }
        }),
    [edges, nodes, selectedEdges, selection, view.edgeKind, view.animateEdges, hiddenLayers],
  )

  /* ---------------- Interaction ---------------- */

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const moves = changes
        .filter(
          (c): c is NodeChange & { type: 'position'; id: string; position: { x: number; y: number } } =>
            c.type === 'position' && 'position' in c && !!c.position && c.dragging === false,
        )
        .map((c) => ({ id: c.id, x: c.position.x, y: c.position.y }))

      if (moves.length > 0) {
        const noteIds = new Set(notes.map((n) => n.id))
        const frameIds = new Set(frames.map((f) => f.id))
        const nodeMoves = moves.filter((m) => !noteIds.has(m.id) && !frameIds.has(m.id))

        for (const m of moves) {
          if (noteIds.has(m.id)) moveNote(m.id, m.x, m.y)
        }
        if (nodeMoves.length > 0) moveNodes(nodeMoves)
      }

      const selChanges = changes.filter(
        (c): c is NodeChange & { type: 'select'; id: string; selected: boolean } => c.type === 'select',
      )
      if (selChanges.length > 0) {
        const picked = selChanges.filter((c) => c.selected).map((c) => c.id)
        if (picked.length > 0) {
          setSelection(picked)
        }
      }
    },
    [moveNodes, moveNote, notes, frames, setSelection],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const picked = changes
        .filter((c): c is EdgeChange & { type: 'select'; id: string; selected: boolean } => c.type === 'select')
        .filter((c) => c.selected)
        .map((c) => c.id)
      if (changes.some((c) => c.type === 'select')) setSelectedEdges(picked)
    },
    [setSelectedEdges],
  )

  const onConnect = useCallback<OnConnect>(
    (params) => {
      if (params.source && params.target) connect(params.source, params.target)
    },
    [connect],
  )

  const onConnectStart = useCallback<OnConnectStart>(
    (_, { nodeId }) => setConnectingFrom(nodeId ?? null),
    [],
  )

  const onConnectEnd = useCallback<OnConnectEnd>(() => setConnectingFrom(null), [])

  /** Library drops and tool-driven clicks both create canvas content. */
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const componentId =
        event.dataTransfer.getData('application/x-aether-component') ||
        event.dataTransfer.getData('application/aether-component')
      const pos = toCanvas(event.clientX, event.clientY)

      if (componentId) {
        addNode(componentId, pos.x - NODE_W / 2, pos.y - NODE_H / 2)
      }
    },
    [addNode, toCanvas],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelection([node.id])
    },
    [setSelection],
  )

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      setMenu(null)
      const pos = toCanvas(event.clientX, event.clientY)
      if (tool === 'note') addNote('note', pos.x, pos.y)
      else if (tool === 'comment') addNote('comment', pos.x, pos.y)
      else if (tool === 'frame') addFrame(pos.x, pos.y)
      else {
        setSelection([])
        setSelectedEdges([])
      }
    },
    [tool, toCanvas, addNote, addFrame, setSelection, setSelectedEdges],
  )

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    const rect = wrapper.current?.getBoundingClientRect()
    setMenu({
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    })
  }, [])

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      const rect = wrapper.current?.getBoundingClientRect()
      if (!selection.includes(node.id)) setSelection([node.id])
      setMenu({
        x: event.clientX - (rect?.left ?? 0),
        y: event.clientY - (rect?.top ?? 0),
        nodeId: node.id,
      })
    },
    [selection, setSelection],
  )

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const graphNode = nodes.find((n) => n.id === node.id)
      if (!graphNode) return
      const comp = COMPONENT_MAP[graphNode.componentId]
      if (comp && !hasComponent(comp.id, { plan, unlocked })) onRequestUnlock(comp.id)
    },
    [nodes, plan, unlocked, onRequestUnlock],
  )

  /* ---------------- Keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return

      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAll()
        return
      }
      if (mod && e.key.toLowerCase() === 'c') {
        copySelection()
        return
      }
      if (mod && e.key.toLowerCase() === 'v') {
        paste()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelection()
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        if (selectedEdges.length > 0) disconnect(selectedEdges)
        if (selection.length > 0) removeNodes(selection)
        return
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 40 : 8
        const map: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        }
        const [dx, dy] = map[e.key] ?? [0, 0]
        nudgeSelection(dx, dy)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    undo,
    redo,
    selectAll,
    copySelection,
    paste,
    duplicateSelection,
    removeNodes,
    disconnect,
    nudgeSelection,
    selection,
    selectedEdges,
  ])

  /** Pans to the selection whenever something outside the canvas changes it. */
  useEffect(() => {
    if (!instance || selection.length === 0) return
    const picked = nodes.filter((n) => selection.includes(n.id))
    if (picked.length === 0) return
    instance.fitBounds(
      {
        x: Math.min(...picked.map((n) => n.x)) - 160,
        y: Math.min(...picked.map((n) => n.y)) - 120,
        width: Math.max(...picked.map((n) => n.x + NODE_W)) - Math.min(...picked.map((n) => n.x)) + 320,
        height: Math.max(...picked.map((n) => n.y + NODE_H)) - Math.min(...picked.map((n) => n.y)) + 240,
      },
      { duration: 420, padding: 0.1 },
    )
    // Only react to explicit focus requests, not every selection click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken])

  const gridVariant = GRID_VARIANT[view.grid]

  return (
    <div
      ref={wrapper}
      className={cn(
        'relative h-full min-h-0 flex-1',
        tool === 'hand' && 'cursor-grab active:cursor-grabbing',
        (tool === 'note' || tool === 'comment' || tool === 'frame') && 'cursor-crosshair',
      )}
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onInit={setInstance}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDoubleClick={onNodeDoubleClick}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: 'var(--brand)', strokeWidth: 2, strokeDasharray: '4 3' }}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag={tool === 'select'}
        panOnDrag={tool === 'hand' ? true : [1, 2]}
        panOnScroll
        zoomOnDoubleClick={false}
        minZoom={0.2}
        maxZoom={2.5}
        defaultViewport={{ x: 40, y: 40, zoom: 0.75 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        className="[&_.react-flow\_\_attribution]:hidden"
      >
        {view.lanes ? <LaneGuides /> : null}

        {gridVariant ? (
          <Background
            variant={gridVariant}
            gap={view.grid === 'lines' ? 64 : 24}
            size={view.grid === 'lines' ? 1 : 1.2}
            color="color-mix(in oklab, var(--foreground) 12%, transparent)"
          />
        ) : null}

        {view.minimap ? (
          <MiniMap
            pannable
            zoomable
            position="bottom-right"
            className="!bottom-20 !right-4 z-20 !m-0 overflow-hidden !rounded-[12px] !border !border-border/80 !bg-background/85 !shadow-lg !backdrop-blur-xl"
            maskColor="color-mix(in oklab, var(--background) 75%, transparent)"
            nodeColor={(n) => {
              if (n.type !== 'component') return 'transparent'
              const id = (n.data as NodeCardData).componentId
              const layer = COMPONENT_MAP[id]?.layer
              return layer ? LAYER_MAP[layer].hue : 'var(--brand)'
            }}
            nodeStrokeWidth={1.5}
            nodeStrokeColor="color-mix(in oklab, var(--foreground) 20%, transparent)"
            nodeBorderRadius={3}
            style={{ width: 168, height: 108 }}
          />
        ) : null}
      </ReactFlow>

      <ViewportHud />

      {menu ? (
        <CanvasContextMenu
          x={menu.x}
          y={menu.y}
          nodeId={menu.nodeId}
          onClose={() => setMenu(null)}
          onUnlock={onRequestUnlock}
          toCanvas={(cx, cy) => {
            const rect = wrapper.current?.getBoundingClientRect()
            return toCanvas(cx + (rect?.left ?? 0), cy + (rect?.top ?? 0))
          }}
        />
      ) : null}

      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-xs text-center">
            <p className="text-[13px] font-medium">Empty canvas</p>
            <p className="mt-1 text-xs leading-relaxed text-tertiary">
              Drag a component from the library on the left, or press{' '}
              <kbd className="rounded-[5px] border border-border bg-secondary px-1 font-mono text-[10px]">
                /
              </kbd>{' '}
              to search everything.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Height of the full lane stack, exported for layout callers. */
export const CANVAS_LANE_HEIGHT = CANVAS_HEIGHT
export const CANVAS_LANE_SIZE = LANE_H
export const CANVAS_LAYER_COUNT = LAYERS.length

export function Canvas(props: { onRequestUnlock?: (componentId: string) => void }) {
  return (
    <ReactFlowProvider>
      <FlowCanvas onRequestUnlock={props.onRequestUnlock ?? (() => {})} />
    </ReactFlowProvider>
  )
}

export { Canvas as LoomCanvas }
