import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, List
from app.api.deps import user_from_token
from app.core import ratelimit
from app.core.config import settings
from app.core.http_security import is_secure
from app.core.logging import get_logger
from app.core.security import SESSION_COOKIE
from app.core.database import async_session_maker
from app.models import Match, Message, User

router = APIRouter()
log = get_logger("chat")

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
        if websocket in self.active_connections.get(user_id, []):
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

CHAT_OPEN_STATUSES = ("accepted", "contact_revealed", "transferred")
MAX_MESSAGE_CHARS = 500


@router.websocket("/ws/chat/{match_id}")
async def websocket_chat_endpoint(websocket: WebSocket, match_id: str):
    """
    Real-time chat for one match. Authenticated by the HttpOnly session cookie
    (sent automatically with the wss:// handshake), never a token in the URL.
    Cross-site pages are refused by checking the Origin header.
    """
    if settings.FORCE_HTTPS and not is_secure(websocket.url.scheme, websocket.headers):
        await websocket.close(code=4003)
        return
    origin = (websocket.headers.get("origin") or "").rstrip("/")
    if origin not in settings.frontend_origins:
        log.warning("Chat socket refused: origin %r not allowed", origin)
        await websocket.close(code=4003)
        return

    async with async_session_maker() as db:
        user = await user_from_token(db, websocket.cookies.get(SESSION_COOKIE, ""))
        if user is None:
            await websocket.close(code=4001)
            return
        user_id = user.id
        match = (await db.execute(select(Match).where(Match.id == match_id))).scalar_one_or_none()
        if not match or user_id not in (match.seeker_id, match.transferor_id) or match.status not in CHAT_OPEN_STATUSES:
            await websocket.close(code=4003)
            return
        other_party_id = match.seeker_id if user_id == match.transferor_id else match.transferor_id

    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            if len(data) > 4 * MAX_MESSAGE_CHARS:
                continue
            try:
                content = str(json.loads(data).get("content", "")).strip()
            except (ValueError, AttributeError):
                continue
            if not content or len(content) > MAX_MESSAGE_CHARS:
                continue
            if not ratelimit.hit(f"chat:{user_id}", 20, 30):
                await websocket.send_json({"error": "You're sending messages too fast. Slow down a little."})
                continue

            async with async_session_maker() as db:
                db_message = Message(match_id=match_id, sender_id=user_id, content=content, msg_type="text")
                db.add(db_message)
                await db.commit()
                await db.refresh(db_message)
                payload_to_send = {
                    "id": db_message.id,
                    "match_id": match_id,
                    "sender_id": user_id,
                    "content": content,
                    "msg_type": "text",
                    "created_at": db_message.created_at.isoformat(),
                }

            await manager.send_personal_message(payload_to_send, user_id)
            await manager.send_personal_message(payload_to_send, other_party_id)
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("Chat socket error for match %s", match_id)
    finally:
        manager.disconnect(websocket, user_id)
