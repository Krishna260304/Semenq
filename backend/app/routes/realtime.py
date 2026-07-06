from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/realtime", tags=["Realtime"])


@router.websocket("/ws")
async def websocket_updates(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(
                {
                    "type": "refresh",
                    "scope": "all",
                }
            )
            await asyncio.sleep(15)
    except WebSocketDisconnect:
        return