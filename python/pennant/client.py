"""Pennant evaluate client for Python."""

from __future__ import annotations

import json
from collections.abc import Mapping, MutableMapping
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class PennantError(Exception):
    """Raised when evaluate fails."""


class PennantClient:
    """POST /api/client/evaluate with a project client key."""

    def __init__(
        self,
        *,
        api_url: str,
        client_key: str,
        environment: str = "development",
        project: str | None = None,
        context: Mapping[str, Any] | None = None,
        opener=None,
    ) -> None:
        self.api_url = api_url.rstrip("/")
        self.client_key = client_key
        self.environment = environment
        self.project = project
        self.context: Mapping[str, Any] = dict(context or {})
        self._opener = opener or urlopen
        self._flags: MutableMapping[str, Mapping[str, Any]] = {}

    def evaluate(
        self, context: Mapping[str, Any] | None = None
    ) -> Mapping[str, Mapping[str, Any]]:
        payload: dict[str, Any] = {
            "context": dict(context if context is not None else self.context),
            "environment": self.environment,
        }
        if self.project:
            payload["project"] = self.project

        body = json.dumps(payload).encode("utf-8")
        request = Request(
            f"{self.api_url}/api/client/evaluate",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.client_key}",
            },
        )
        try:
            with self._opener(request) as response:
                raw = response.read().decode("utf-8")
                status = getattr(response, "status", None) or response.getcode()
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            try:
                message = json.loads(detail).get("error") or detail
            except json.JSONDecodeError:
                message = detail or str(exc)
            raise PennantError(message) from exc
        except URLError as exc:
            raise PennantError(str(exc.reason or exc)) from exc

        if status and int(status) >= 400:
            raise PennantError(f"Evaluation failed ({status}).")

        parsed = json.loads(raw) if raw else {}
        flags = parsed.get("flags") or {}
        if not isinstance(flags, dict):
            raise PennantError("Response flags must be an object.")
        self._flags = flags
        return flags

    def get_flags(self) -> Mapping[str, Mapping[str, Any]]:
        return self._flags

    def is_enabled(self, key: str) -> bool:
        flag = self._flags.get(key) or {}
        return bool(flag.get("enabled", False))

    def get_variant(self, key: str) -> str | None:
        flag = self._flags.get(key) or {}
        variant = flag.get("variant")
        return variant if isinstance(variant, str) else None


def is_enabled(flags: Mapping[str, Mapping[str, Any]], key: str) -> bool:
    flag = flags.get(key) or {}
    return bool(flag.get("enabled", False))


def get_variant(flags: Mapping[str, Mapping[str, Any]], key: str) -> str | None:
    flag = flags.get(key) or {}
    variant = flag.get("variant")
    return variant if isinstance(variant, str) else None
