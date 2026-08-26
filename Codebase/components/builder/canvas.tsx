'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  useViewport,
  type Edge,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AlertTriangle } from 'lucide-react'
import { COMPONENT_MAP, LAYER_MAP, LAYERS, PORT_COLORS } from '@/mock/layers'
import {
  BAND_H,
  NODE_H,
  NODE_W,
  computeBands,
  nodePosition,
  useBuilder,
  type BandLayout,
} from '@/lib/builder-store'
import { portsCompatible } from '@/lib/validate'
import { hasComponent } from '@/lib/entitlements'
import { useSession } from '@/lib/store'
import { useWorkspace } from '@/lib/workspace-store'
import { LoomNode, type LoomNodeData } from '@/components/builder/node-card'
import { DRAG_MIME, DRAG_PRESET_MIME } from '@/components/builder/library-panel'

const nodeTypes = { loom: LoomNode }

/** Tinted horizontal bands, drawn in flow space behind the nodes. */
function LayerBands({ bands, width }: { bands: BandLayout[]; width: number }) {
  const { x, y, zoom } = useViewport()

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}
      >
        {bands.map((band) => {
          const layer = LAYER_MAP[band.layer]
          return (
            <div
              key={band.layer}
              className="absolute left-0 border-b border-dashed"
              style={{
                top: band.top,
                height: band.height,
                width,
                borderColor: `${layer.hue}20`,
                background: `linear-gradient(90deg, ${layer.hue}0a, transparent 45%)`,
              }}
            >
              <span
                className="absolute top-2 left-3 flex items-baseline gap-2 text-[11px] font-medium whitespace-nowrap"
                style={{ color: `${layer.hue}b0` }}
              >
                <span className="tabular">{layer.roman}</span>
                <span>{layer.name}</span>
                {band.collapsed ? <span className="opacity-70">· collapsed</span> : null}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CanvasInner() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    selection,
    collapsedLayers,
    issues,
    validated,
    rejection,
    focusToken,
    addNode,
    addBlock,
    moveNodes,
    connect,
    setSelection,
    clearRejection,
  } = useBuilder()

  const { plan, unlocked } = useSession()
  const myPresets = useWorkspace((s) => s.myPresets)
  const { screenToFlowPosition } = useReactFlow()
  const wrapper = useRef<HTMLDivElement>(null)

  const access = useMemo(() => ({ plan, unlocked }), [plan, unlocked])
  const bands = useMemo(() => computeBands(new Set(collapsedLayers)), [collapsedLayers])

  /** Node ids flagged by the last validation pass, so cards can show red. */
  const errorIds = useMemo(
    () =>
      new Set(
        validated
          ? issues.filter((i) => i.level === 'error').flatMap((i) => i.nodeIds ?? [])
          : [],
      ),
    [issues, validated],
  )

  const canvasWidth = useMemo(
    () => Math.max(2400, ...storeNodes.map((n) => n.x + NODE_W + 400)),
    [storeNodes],
  )

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node<LoomNodeData>>([])

  /**
   * React Flow owns positions while dragging, so the store is only mirrored in
   * when something structural actually changes. This signature is that trigger.
   */
  const signature = useMemo(
    () =>
      JSON.stringify([
        storeNodes.map((n) => [n.id, n.x, n.enabled, n.needsConfig, n.componentId]),
        collapsedLayers,
        [...errorIds],
        unlocked.length,
        plan,
        focusToken,
      ]),
    [storeNodes, collapsedLayers, errorIds, unlocked.length, plan, focusToken],
  )

  useEffect(() => {
    setRfNodes(
      storeNodes.map((n) => {
        const comp = COMPONENT_MAP[n.componentId]
        const collapsed = comp ? collapsedLayers.includes(comp.layer) : false
        return {
          id: n.id,
          type: 'loom',
          position: nodePosition(n, bands),
          selected: selection.includes(n.id),
          hidden: collapsed,
          data: {
            componentId: n.componentId,
            enabled: n.enabled,
            needsConfig: n.needsConfig ?? false,
            locked: !hasComponent(n.componentId, access),
            hasError: errorIds.has(n.id),
          },
        }
      }),
    )
    // `selection` is deliberately excluded: React Flow drives selection itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, bands, access, setRfNodes])

  const edges = useMemo<Edge[]>(
    () =>
      storeEdges.map((e) => {
        const source = storeNodes.find((n) => n.id === e.source)
        const target = storeNodes.find((n) => n.id === e.target)
        const shared =
          source && target ? portsCompatible(source.componentId, target.componentId) : []
        const port = shared[0]
        const stroke = port ? PORT_COLORS[port] : 'var(--border)'
        const muted = source && target ? !source.enabled || !target.enabled : false

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: port ?? null,
          targetHandle: port ?? null,
          animated: !muted,
          style: { stroke, strokeWidth: 1.5, opacity: muted ? 0.3 : 0.85 },
        }
      }),
    [storeEdges, storeNodes],
  )

  /** Commits horizontal movement only — vertical position belongs to the band. */
  const handleNodeDragStop = useCallback(() => {
    const moves = rfNodes
      .map((n) => {
        const original = storeNodes.find((s) => s.id === n.id)
        return original && Math.round(n.position.x) !== original.x
          ? { id: n.id, x: n.position.x }
          : null
      })
      .filter((m): m is { id: string; x: number } => m !== null)
    if (moves.length > 0) moveNodes(moves)
  }, [rfNodes, storeNodes, moveNodes])

  const handleSelectionChange = useCallback(
    ({ nodes }: OnSelectionChangeParams) => setSelection(nodes.map((n) => n.id)),
    [setSelection],
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<LoomNodeData>>[]) => {
      // Removals are routed through the store so history stays correct.
      const removals = changes.filter((c) => c.type === 'remove').map((c) => c.id)
      if (removals.length > 0) {
        useBuilder.getState().removeNodes(removals)
        return
      }
      onNodesChange(changes)
    },
    [onNodesChange],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })

      const componentId = event.dataTransfer.getData(DRAG_MIME)
      if (componentId) {
        addNode(componentId, position.x - NODE_W / 2, position.y)
        return
      }

      const presetId = event.dataTransfer.getData(DRAG_PRESET_MIME)
      if (presetId) {
        const preset = myPresets.find((p) => p.id === presetId)
        if (preset?.nodes?.length) addBlock(preset.nodes, preset.edges ?? [])
      }
    },
    [screenToFlowPosition, addNode, addBlock, myPresets],
  )

  useEffect(() => {
    if (!rejection) return
    const timer = setTimeout(clearRejection, 3600)
    return () => clearTimeout(timer)
  }, [rejection, clearRejection])

  return (
    <div ref={wrapper} className="relative min-h-0 flex-1">
      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onSelectionChange={handleSelectionChange}
        onConnect={({ source, target }) => source && target && connect(source, target)}
        onEdgesDelete={(deleted) => useBuilder.getState().disconnect(deleted.map((e) => e.id))}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onPaneClick={() => setSelection([])}
        defaultViewport={{ x: 40, y: 24, zoom: 0.85 }}
        minZoom={0.25}
        maxZoom={1.75}
        selectionOnDrag
        panOnDrag={[1, 2]}
        panOnScroll
        zoomOnDoubleClick={false}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Meta', 'Shift', 'Control']}
        proOptions={{ hideAttribution: true }}
        className="[&_.react-flow\_\_handle]:!border-black/20"
      >
        <LayerBands bands={bands} width={canvasWidth} />
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          className="!text-border"
          color="currentColor"
        />
      </ReactFlow>

      {storeNodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="glass max-w-xs rounded-[var(--radius-lg)] p-5 text-center">
            <p className="text-sm font-medium">Empty canvas</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Drag a node from the library to begin. Most bots start with an{' '}
              <span className="font-medium text-foreground">OHLCV Price Feed</span> in Layer I.
            </p>
          </div>
        </div>
      ) : null}

      {rejection ? (
        <div
          role="status"
          className="glass absolute bottom-4 left-1/2 flex max-w-md -translate-x-1/2 items-start gap-2.5 rounded-[var(--radius-md)] border-warning/40 p-3"
        >
          <AlertTriangle className="mt-px size-4 shrink-0 text-warning" />
          <p className="text-[13px] leading-relaxed">{rejection}</p>
        </div>
      ) : null}
    </div>
  )
}

/** Vertical span of all bands, used to size the scrollable canvas. */
export const CANVAS_HEIGHT = LAYERS.length * BAND_H + NODE_H

export function LoomCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
