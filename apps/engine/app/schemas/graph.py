from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

class BotNode(BaseModel):
  id: str
  componentId: str
  x: float = 0
  y: float = 0
  enabled: bool = True
  config: Dict[str, Any] = Field(default_factory=dict)
  needsConfig: Optional[bool] = False

class BotEdge(BaseModel):
  id: str
  source: str
  target: str

class CanvasNote(BaseModel):
  id: str
  kind: Literal['note', 'comment'] = 'note'
  x: float = 0
  y: float = 0
  text: str = ''
  color: Literal['amber', 'blue', 'green', 'pink', 'slate'] = 'amber'
  createdAt: str = ''
  resolved: Optional[bool] = False

class CanvasFrame(BaseModel):
  id: str
  x: float = 0
  y: float = 0
  w: float = 0
  h: float = 0
  label: str = ''
  hue: str = ''

class BotGraph(BaseModel):
  nodes: List[BotNode] = Field(default_factory=list)
  edges: List[BotEdge] = Field(default_factory=list)
  notes: List[CanvasNote] = Field(default_factory=list)
  frames: List[CanvasFrame] = Field(default_factory=list)
  schemaVersion: int = 2
