from __future__ import annotations

import io
import json
import unittest
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request

from pennant import PennantClient, get_variant, is_enabled


class _FakeResponse:
    def __init__(self, payload: dict[str, Any], status: int = 200) -> None:
        self._raw = json.dumps(payload).encode("utf-8")
        self.status = status

    def read(self) -> bytes:
        return self._raw

    def getcode(self) -> int:
        return self.status

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None


class PennantClientTests(unittest.TestCase):
    def test_posts_bearer_and_context_fields(self) -> None:
        seen: dict[str, Any] = {}

        def opener(request: Request, timeout: float | None = None):
            seen["url"] = request.full_url
            seen["method"] = request.get_method()
            seen["authorization"] = request.get_header("Authorization")
            seen["content_type"] = request.get_header("Content-type")
            seen["body"] = json.loads(request.data.decode("utf-8"))
            return _FakeResponse(
                {
                    "flags": {
                        "checkout-v2": {"enabled": True, "variant": "treatment"},
                    }
                }
            )

        client = PennantClient(
            api_url="http://127.0.0.1:3847/",
            client_key="pennant-client-demo",
            environment="production",
            project="default",
            context={
                "userId": "ada",
                "remoteAddress": "127.0.0.1",
                "hostname": "app.local",
            },
            opener=opener,
        )
        flags = client.evaluate()
        self.assertEqual(seen["url"], "http://127.0.0.1:3847/api/client/evaluate")
        self.assertEqual(seen["method"], "POST")
        self.assertEqual(seen["authorization"], "Bearer pennant-client-demo")
        self.assertEqual(seen["content_type"], "application/json")
        self.assertEqual(
            seen["body"],
            {
                "context": {
                    "userId": "ada",
                    "remoteAddress": "127.0.0.1",
                    "hostname": "app.local",
                },
                "environment": "production",
                "project": "default",
            },
        )
        self.assertTrue(client.is_enabled("checkout-v2"))
        self.assertEqual(client.get_variant("checkout-v2"), "treatment")
        self.assertTrue(is_enabled(flags, "checkout-v2"))
        self.assertEqual(get_variant(flags, "checkout-v2"), "treatment")

    def test_raises_on_http_error(self) -> None:
        def opener(request: Request, timeout: float | None = None):
            raise HTTPError(
                request.full_url,
                401,
                "Unauthorized",
                hdrs=None,
                fp=io.BytesIO(json.dumps({"error": "Invalid client key."}).encode("utf-8")),
            )

        client = PennantClient(
            api_url="http://127.0.0.1:3847",
            client_key="bad-key",
            opener=opener,
        )
        with self.assertRaisesRegex(Exception, "Invalid client key"):
            client.evaluate()


if __name__ == "__main__":
    unittest.main()
