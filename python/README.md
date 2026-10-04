# pennant

Python client for [Pennant](../README.md). Matches [`CONTRACT.md`](../CONTRACT.md).

## Install

```bash
pip install pennant-sdk
# straight from GitHub:
pip install "pennant-sdk @ git+https://github.com/gizmo0506/pennant-sdks.git@python/v1.1.0#subdirectory=python"
# local checkout:
pip install ./python
```

The PyPI name is `pennant-sdk`. The import name is `pennant`.

## Usage

```python
from pennant import PennantClient

client = PennantClient(
    api_url="http://127.0.0.1:3847",
    client_key="pennant-client-demo",
    environment="development",
    context={"userId": "ada-lovelace", "remoteAddress": "127.0.0.1"},
)
flags = client.evaluate()
if client.is_enabled("checkout-v2"):
    print(client.get_variant("checkout-v2"))
```
