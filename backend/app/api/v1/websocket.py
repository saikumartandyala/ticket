import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, List
from jose import jwt, JWTError

from app.core.config import settings
from app.core.database import async_session_maker
from app.models import Match, Message, User

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> list of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

@router.websocket("/ws/chat/{match_id}")
async def websocket_chat_endpoint(websocket: WebSocket, match_id: str, token: str):
    """
    WebSocket endpoint for real-time chat per match.
    Validates JWT token, confirms user belongs to match, manages messages.
    """
    # 1. Authenticate user from query parameter
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
    except JWTError:
        await websocket.close(code=4003) # Forbidden/Unauthorized
        return

    # 2. Open DB Session and verify membership
    async with async_session_maker() as db:
        match_res = await db.execute(select(Match).where(Match.id == match_id))
        match = match_res.scalar_one_or_none()
        if not match or (match.seeker_id != user_id and match.transferor_id != user_id):
            await websocket.close(code=4003)
            return

        other_party_id = match.seeker_id if user_id == match.transferor_id else match.transferor_id

    await manager.connect(websocket, user_id)
    
    try:
        while True:
            # Receive text data
            data = await websocket.receive_text()
            message_data = json.loads(data)
            content = message_data.get("content", "").strip()
            
            if not content:
                continue

            # Save to database
            async with async_session_maker() as db:
                db_message = Message(
                    match_id=match_id,
                    sender_id=user_id,
                    content=content,
                    msg_type="text"
                )
                db.add(db_message)
                await db.commit()
                await db.refresh(db_message)
                
                payload_to_send = {
                    "id": db_message.id,
                    "match_id": match_id,
                    "sender_id": user_id,
                    "content": content,
                    "msg_type": "text",
                    "created_at": db_message.created_at.isoformat()
                }

            # Broadcast to both sender and receiver
            await manager.send_personal_message(payload_to_send, user_id)
            await manager.send_personal_message(payload_to_send, other_party_id)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        manager.disconnect(websocket, user_id)
