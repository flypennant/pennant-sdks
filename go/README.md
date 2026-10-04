# pennant (Go)

Go client for [Pennant](../README.md). Matches [`CONTRACT.md`](../CONTRACT.md). No cgo.

## Install

```bash
go get github.com/gizmo0506/pennant-sdks/go@latest
# or from a local checkout:
go mod edit -replace github.com/gizmo0506/pennant-sdks/go=./go
```

## Usage

```go
client := pennant.NewClient(pennant.ClientOptions{
  APIURL:      "http://127.0.0.1:3847",
  ClientKey:   "pennant-client-demo",
  Environment: "development",
  Context: pennant.EvaluationContext{
    UserID:        "ada-lovelace",
    RemoteAddress: "127.0.0.1",
  },
})
flags, err := client.Evaluate(nil)
```
