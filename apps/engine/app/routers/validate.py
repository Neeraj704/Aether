from fastapi import APIRouter, HTTPException
from ..schemas.graph import BotGraph
from ..graph.validate import validate_bot_graph

router = APIRouter(tags=["Validation"])

@router.post("/validate-graph")
def validate_graph_endpoint(graph: BotGraph):
    try:
        return validate_bot_graph(graph)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")
