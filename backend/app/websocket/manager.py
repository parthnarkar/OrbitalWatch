from __future__ import annotations


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[str] = set()

    async def connect(self, sid: str, environ: dict) -> None:
        self._connections.add(sid)

    async def disconnect(self, sid: str) -> None:
        self._connections.discard(sid)

    def get_active_connections(self) -> set[str]:
        return set(self._connections)


manager = ConnectionManager()
