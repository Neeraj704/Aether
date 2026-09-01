from typing import List, Dict, Any, Optional
from ..schemas.graph import BotGraph, BotNode

# Layer categorization helper
COMPONENT_LAYER_MAP = {
    'ohlcv-feed': 'data',
    'orderbook-depth': 'data',
    'news-stream': 'data',
    'social-sentiment': 'data',
    'economic-calendar': 'data',
    'fundamentals': 'data',
    'options-chain': 'data',
    'onchain-feed': 'data',

    'ta-indicators': 'features',
    'technical-indicators': 'features',
    'normalizer': 'features',
    'regime-tagger': 'features',
    'nlp-embedder': 'features',
    'cross-asset-correlation': 'features',
    'microstructure': 'features',
    'feature-selector': 'features',

    'technical-agent': 'agents',
    'technical-analyst': 'agents',
    'sentiment-agent': 'agents',
    'macro-agent': 'agents',
    'flow-agent': 'agents',
    'contrarian-agent': 'agents',
    'event-agent': 'agents',

    'gbdt-forecast': 'ml',
    'transformer-forecast': 'ml',
    'vol-forecast': 'ml',
    'ensemble-stacker': 'ml',
    'meta-labeler': 'ml',

    'position-sizing-policy': 'rl',
    'execution-timing-policy': 'rl',
    'trailing-exit-policy': 'rl',

    'bull-bear': 'debate',
    'moderator': 'debate',
    'stress-test': 'debate',
    'debate-log': 'debate',

    'calibrator': 'confidence',
    'agreement-score': 'confidence',
    'uncertainty-bands': 'confidence',
    'confidence-gate': 'confidence',
    'drift-monitor': 'confidence',

    'position-cap': 'risk',
    'drawdown-brake': 'risk',
    'risk-gate': 'risk',
    'correlation-guard': 'risk',
    'daily-loss-limit': 'risk',
    'event-blackout': 'risk',
    'var-monitor': 'risk',

    'paper-executor': 'execution',
    'market-order': 'execution',
    'limit-ladder': 'execution',
    'twap-vwap': 'execution',
    'adaptive-iceberg': 'execution',

    'pnl-tracker': 'monitoring',
    'anomaly-watch': 'monitoring',
    'latency-watch': 'monitoring',
    'decision-log': 'monitoring',

    'post-mortem': 'learning',
    'rule-derivation': 'learning',
    'retrain-trigger': 'learning',
    'regime-shift-detector': 'learning',

    'vector-recall': 'memory',
    'outcome-store': 'memory',
    'lesson-bank': 'memory',
}

class Issue:
    def __init__(self, message: str, severity: str = 'error', node_id: Optional[str] = None):
        self.message = message
        self.severity = severity
        self.nodeId = node_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            'nodeId': self.nodeId,
            'message': self.message,
            'severity': self.severity,
        }

def validate_bot_graph(graph: BotGraph) -> Dict[str, Any]:
    issues: List[Issue] = []
    
    active_nodes = [n for n in graph.nodes if n.enabled]
    nodes_by_id: Dict[str, BotNode] = {n.id: n for n in graph.nodes}

    if not graph.nodes or not active_nodes:
        issues.append(Issue("Graph contains zero enabled nodes", severity="error"))
        return {
            "valid": False,
            "issues": [i.to_dict() for i in issues]
        }

    # 1. Unconfigured nodes warning
    for node in active_nodes:
        if node.needsConfig:
            issues.append(Issue(
                f"Node '{node.componentId}' has required configuration fields empty",
                severity="warning",
                node_id=node.id
            ))

    # 2. Layer checks
    active_edges = [
        e for e in graph.edges 
        if e.source in nodes_by_id and e.target in nodes_by_id and 
        nodes_by_id[e.source].enabled and nodes_by_id[e.target].enabled
    ]

    data_node_ids = set()
    exec_node_ids = set()
    learning_node_ids = set()
    monitoring_node_ids = set()

    for node in active_nodes:
        layer = COMPONENT_LAYER_MAP.get(node.componentId, 'unknown')
        if layer == 'data':
            data_node_ids.add(node.id)
        elif layer == 'execution':
            exec_node_ids.add(node.id)
        elif layer == 'learning':
            learning_node_ids.add(node.id)
        elif layer == 'monitoring':
            monitoring_node_ids.add(node.id)

    # Execution node cannot have Data-Collection node as direct upstream input
    for edge in active_edges:
        src = nodes_by_id.get(edge.source)
        tgt = nodes_by_id.get(edge.target)
        if src and tgt:
            src_layer = COMPONENT_LAYER_MAP.get(src.componentId, '')
            tgt_layer = COMPONENT_LAYER_MAP.get(tgt.componentId, '')
            if src_layer == 'data' and tgt_layer == 'execution':
                issues.append(Issue(
                    f"Direct edge from Data Collection node '{src.componentId}' to Execution node '{tgt.componentId}' is forbidden. A Risk Management node must sit between them.",
                    severity="error",
                    node_id=tgt.id
                ))

    # Self-learning layer node must have at least one trade-monitoring output
    for l_id in learning_node_ids:
        incoming_sources = [e.source for e in active_edges if e.target == l_id]
        has_monitoring = any(
            COMPONENT_LAYER_MAP.get(nodes_by_id[s].componentId) == 'monitoring'
            for s in incoming_sources if s in nodes_by_id
        )
        if not has_monitoring:
            issues.append(Issue(
                f"Self-Learning node must be connected to a Trade Monitoring layer output",
                severity="warning",
                node_id=l_id
            ))

    # Reachability from Data Collection to Execution
    if exec_node_ids:
        if not data_node_ids:
            issues.append(Issue("Graph contains Execution nodes but no Data Collection feed", severity="error"))
        else:
            # Check if at least one exec node is reachable from any data node
            adj: Dict[str, List[str]] = {}
            for e in active_edges:
                adj.setdefault(e.source, []).append(e.target)

            visited = set()
            queue = list(data_node_ids)
            while queue:
                curr = queue.pop(0)
                if curr not in visited:
                    visited.add(curr)
                    for nxt in adj.get(curr, []):
                        if nxt not in visited:
                            queue.append(nxt)

            reachable_exec = exec_node_ids.intersection(visited)
            if not reachable_exec:
                issues.append(Issue(
                    "Execution node is unreachable from any Data Collection node in the graph",
                    severity="error"
                ))

    has_errors = any(i.severity == 'error' for i in issues)
    return {
        "valid": not has_errors,
        "issues": [i.to_dict() for i in issues]
    }
