# pennant

Python client for [Pennant](../../README.md). Matches `sdk/CONTRACT.md`.

## Install

```bash
pip install ./sdk/python
```

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
