import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from '@xyflow/react'
import { useCallback, useMemo, useState, type MouseEvent } from 'react'

import { AssociationLinks } from '@/canvas/AssociationLinks'
import { canConnect } from '@/canvas/interaction/connectionRules'
import { useAddMember } from '@/canvas/interaction/useAddMember'
import { useCreateClassifier } from '@/canvas/interaction/useCreateClassifier'
import { useCreateRelation } from '@/canvas/interaction/useCreateRelation'
import { useKeyboard } from '@/canvas/interaction/useKeyboard'
import { usePaletteDrop } from '@/canvas/interaction/usePaletteDrop'
import { edgeTypes } from '@/canvas/edgeTypes'
import { UmlMarkers } from '@/canvas/markers/UmlMarkers'
import { nodeTypes } from '@/canvas/nodeTypes'
import { removeEdges, removeNodes, resizeNode, setNodePosition, setViewport } from '@/state/commands'
import {
  selectFlowEdges,
  selectFlowNodes,
  type UmlFlowEdge,
  type UmlFlowNode,
} from '@/state/selectors'
import { useDiagramStore } from '@/state/useDiagramStore'
import { CanvasNotice } from '@/ui/CanvasNotice'

/**
 * Applies React Flow's select changes onto the store selection.
 *
 * In controlled mode the change handlers are the authoritative channel: if the
 * selection is not written back into the document state, the next render pushes
 * `selected: false` from our props and the element deselects itself. That was
 * why a relation could not be selected to edit its name.
 */
type SelectChange = { type: 'select'; id: string; selected: boolean }

const isSelectChange = (change: { type: string }): change is SelectChange =>
  change.type === 'select'

function applySelectChanges(
  changes: readonly { type: string }[],
  current: readonly string[],
): string[] | null {
  const selectChanges = changes.filter(isSelectChange)
  if (selectChanges.length === 0) return null

  const next = new Set(current)
  for (const change of selectChanges) {
    if (change.selected) next.add(change.id)
    else next.delete(change.id)
  }

  const ids = [...next]
  const unchanged = ids.length === current.length && ids.every((id, index) => current[index] === id)

  return unchanged ? null : ids
}

const GRID_SIZE = 8

/** Small moves must not start a drag, or a double click never lands. */
const DRAG_THRESHOLD = 4

/**
 * The React Flow instance. This is the ONE place where canvas events are
 * translated into commands (CLAUDE.md §6.3); no business logic lives here.
 *
 * Dragging emits dozens of events per second. Only the last one is a document
 * change: while the gesture runs the positions live in ephemeral local state,
 * so a whole drag is a single undo step and the document stays clean.
 */
function Canvas() {
  const storeNodes = useDiagramStore(selectFlowNodes)
  const edges = useDiagramStore(selectFlowEdges)
  const dispatch = useDiagramStore((state) => state.dispatch)
  const activeDiagramId = useDiagramStore((state) => state.activeDiagramId)
  const tool = useDiagramStore((state) => state.tool)

  const [gestureNodes, setGestureNodes] = useState<UmlFlowNode[] | null>(null)

  /**
   * The sizes React Flow measured, kept as ephemeral view state because §10.2
   * forbids persisting `measured` — the document says `height: null` for a box
   * whose height comes from its content.
   *
   * It is not decoration. Anything reading nodes through the public array —
   * the minimap above all — asks `nodeHasDimensions(node)`, which looks for
   * `measured`, `width` or `initialWidth` on the node object itself. Our nodes
   * only carry `style.width`, so without this the minimap finds no dimensions
   * and draws nothing at all.
   */
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})

  const nodes = useMemo(() => {
    const base = gestureNodes ?? storeNodes

    return base.map((node) => {
      const size = measured[node.id]
      return size === undefined ? node : { ...node, measured: size }
    })
  }, [gestureNodes, storeNodes, measured])

  const { onDragOver, onDrop } = usePaletteDrop()
  const { screenToFlowPosition } = useReactFlow()
  const createClassifier = useCreateClassifier()
  const createRelation = useCreateRelation()
  const addMemberTo = useAddMember()
  useKeyboard()

  const isRelationTool = tool.kind === 'relation'

  const onNodesChange = useCallback(
    (changes: NodeChange<UmlFlowNode>[]) => {
      // Measurement reports arrive as `dimensions` changes with no `resizing`
      // flag, so they have to be picked up before the gesture branch returns.
      const sizes: Record<string, { width: number; height: number }> = {}

      for (const change of changes) {
        if (change.type === 'dimensions' && change.dimensions) {
          sizes[change.id] = change.dimensions
        }
      }

      if (Object.keys(sizes).length > 0) {
        setMeasured((current) => {
          let changed = false
          const next = { ...current }

          for (const [id, size] of Object.entries(sizes)) {
            const previous = current[id]
            if (previous?.width !== size.width || previous.height !== size.height) {
              next[id] = size
              changed = true
            }
          }

          // Same object when nothing moved: re-measuring must not re-render.
          return changed ? next : current
        })
      }

      const isGesture = changes.some(
        (change) =>
          (change.type === 'position' && change.dragging === true) ||
          (change.type === 'dimensions' && change.resizing === true),
      )

      // In-flight drag or resize: ephemeral only, the document is not touched.
      if (isGesture) {
        setGestureNodes((current) => applyNodeChanges(changes, current ?? storeNodes))
        return
      }

      const state = useDiagramStore.getState()
      const selected = applySelectChanges(changes, state.selection.nodes)
      if (selected) state.setSelection({ nodes: selected })

      const removedIds: string[] = []

      for (const change of changes) {
        if (change.type === 'position' && change.dragging === false && change.position) {
          dispatch(setNodePosition({ id: change.id, position: change.position }))
        } else if (change.type === 'dimensions' && change.resizing === false && change.dimensions) {
          dispatch(
            resizeNode({
              id: change.id,
              size: { width: change.dimensions.width, height: change.dimensions.height },
            }),
          )
        } else if (change.type === 'remove') {
          removedIds.push(change.id)
        }
      }

      if (removedIds.length > 0) {
        dispatch(removeNodes({ ids: removedIds }))
        setMeasured((current) => {
          const next = { ...current }
          for (const id of removedIds) delete next[id]
          return next
        })
      }

      setGestureNodes(null)
    },
    [dispatch, storeNodes],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<UmlFlowEdge>[]) => {
      const state = useDiagramStore.getState()
      const selected = applySelectChanges(changes, state.selection.edges)
      if (selected) state.setSelection({ edges: selected })

      const removedIds = changes.filter((change) => change.type === 'remove').map((change) => change.id)

      if (removedIds.length > 0) dispatch(removeEdges({ ids: removedIds }))
    },
    [dispatch],
  )

  /** Asked live while dragging, and again on release: they can never disagree. */
  const isValidConnection = useCallback((connection: Connection | UmlFlowEdge) => {
    const state = useDiagramStore.getState()
    if (state.tool.kind !== 'relation') return false

    return canConnect(state.doc, state.tool.relationKind, connection.source, connection.target)
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      const state = useDiagramStore.getState()
      if (state.tool.kind !== 'relation') return

      createRelation(state.tool.relationKind, connection.source, connection.target)
      state.setPendingConnection(null)
    },
    [createRelation],
  )

  /** What a click on a classifier means depends on the armed tool. */
  const onNodeClick = useCallback(
    (_event: MouseEvent, node: UmlFlowNode) => {
      const state = useDiagramStore.getState()

      // A member tool drops an attribute or an operation into the box.
      if (state.tool.kind === 'member') {
        addMemberTo(node.id, state.tool.memberKind)
        return
      }

      if (state.tool.kind !== 'relation') return

      // Click the source, then click the target: the other way to draw a relation.
      const pending = state.pendingConnection
      if (!pending) {
        state.setPendingConnection({ sourceId: node.id })
        return
      }

      createRelation(state.tool.relationKind, pending.sourceId, node.id)
      state.setPendingConnection(null)
    },
    [addMemberTo, createRelation],
  )

  // Click-to-place: the tool stays armed so several can be created in a row.
  const onPaneClick = useCallback(
    (event: MouseEvent) => {
      const state = useDiagramStore.getState()

      if (state.tool.kind === 'relation') {
        state.setPendingConnection(null)
        return
      }
      if (state.tool.kind !== 'classifier') return

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      createClassifier(state.tool.classifierKind, position, state.tool.variantId)
    },
    [createClassifier, screenToFlowPosition],
  )

  // Pan and zoom: one dispatch per gesture, and never in the history.
  const onMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      dispatch(setViewport({ id: activeDiagramId, viewport }), { history: false })
    },
    [activeDiagramId, dispatch],
  )

  return (
    <div className="relative h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <UmlMarkers />
      <CanvasNotice />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={{ stroke: '#0284c7', strokeWidth: 1.5, strokeDasharray: '5 4' }}
        nodeDragThreshold={DRAG_THRESHOLD}
        // While drawing a relation the boxes must not move under the pointer.
        nodesDraggable={!isRelationTool}
        snapToGrid
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        minZoom={0.1}
        maxZoom={4}
        // Deleting goes through our own shortcut, so it becomes a command.
        deleteKeyCode={null}
        multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-50"
      >
        <AssociationLinks />
        <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} size={1} />
        {/*
          * The default node fill is #e2e2e2 on a white panel, which is barely
          * visible. These follow the classifier boxes instead. It only ever
          * draws nodes: React Flow's minimap has no concept of edges, so the
          * relations are not missing, they are simply not something it renders.
          */}
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => (node.selected ? '#bae6fd' : '#ffffff')}
          nodeStrokeColor="#64748b"
          nodeStrokeWidth={3}
          maskColor="rgba(100, 116, 139, 0.15)"
          bgColor="#f8fafc"
        />
        <Controls />
      </ReactFlow>
    </div>
  )
}

/** The provider stays here so canvas hooks work in the whole subtree. */
export function UmlCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
