from typing import List, Dict, Set
from ..schemas.graph import BotGraph, BotNode

def compile_graph(graph: BotGraph) -> List[BotNode]:
    """
    Topologically sorts enabled nodes in BotGraph using Kahn's algorithm.
    Ensures every node executes after all of its upstream dependencies.
    Raises ValueError if a cycle or unresolvable dependency is detected.
    """
    # Filter enabled nodes
    enabled_nodes: Dict[str, BotNode] = {n.id: n for n in graph.nodes if n.enabled}
    if not enabled_nodes:
        return []

    # Filter edges between enabled nodes
    in_degree: Dict[str, int] = {nid: 0 for nid in enabled_nodes}
    adj: Dict[str, List[str]] = {nid: [] for nid in enabled_nodes}

    for edge in graph.edges:
        if edge.source in enabled_nodes and edge.target in enabled_nodes:
            adj[edge.source].append(edge.target)
            in_degree[edge.target] += 1

    # Nodes with 0 in-degree can run first
    queue: List[str] = [nid for nid, deg in in_degree.items() if deg == 0]
    ordered_nodes: List[BotNode] = []

    while queue:
        curr_id = queue.pop(0)
        ordered_nodes.append(enabled_nodes[curr_id])

        for neighbor in adj[curr_id]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(ordered_nodes) != len(enabled_nodes):
        raise ValueError("Cycle detected or unresolvable dependency in strategy graph")

    return ordered_nodes
