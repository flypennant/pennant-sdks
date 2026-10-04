package pennant

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEvaluatePostsBearerAndContext(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/client/evaluate" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s", r.Method)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer pennant-client-demo" {
			t.Fatalf("Authorization = %q", got)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Fatalf("Content-Type = %q", got)
		}
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatal(err)
		}
		var body map[string]any
		if err := json.Unmarshal(raw, &body); err != nil {
			t.Fatal(err)
		}
		context, _ := body["context"].(map[string]any)
		if context["userId"] != "ada" {
			t.Fatalf("userId = %#v", context["userId"])
		}
		if context["remoteAddress"] != "127.0.0.1" {
			t.Fatalf("remoteAddress = %#v", context["remoteAddress"])
		}
		if context["hostname"] != "app.local" {
			t.Fatalf("hostname = %#v", context["hostname"])
		}
		if body["environment"] != "production" {
			t.Fatalf("environment = %#v", body["environment"])
		}
		if body["project"] != "default" {
			t.Fatalf("project = %#v", body["project"])
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"flags": map[string]any{
				"checkout-v2": map[string]any{
					"enabled": true,
					"variant": "treatment",
				},
			},
		})
	}))
	defer server.Close()

	client := NewClient(ClientOptions{
		APIURL:      server.URL + "/",
		ClientKey:   "pennant-client-demo",
		Environment: "production",
		Project:     "default",
		Context: EvaluationContext{
			UserID:        "ada",
			RemoteAddress: "127.0.0.1",
			Hostname:      "app.local",
		},
		HTTPClient: server.Client(),
	})
	flags, err := client.Evaluate(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !client.IsEnabled("checkout-v2") {
		t.Fatal("expected checkout-v2 enabled")
	}
	if got := client.GetVariant("checkout-v2"); got != "treatment" {
		t.Fatalf("variant = %q", got)
	}
	if !IsEnabledIn(flags, "checkout-v2") {
		t.Fatal("expected map enabled")
	}
	if got := GetVariantIn(flags, "checkout-v2"); got != "treatment" {
		t.Fatalf("map variant = %q", got)
	}
}

func TestEvaluateUnauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Invalid client key."})
	}))
	defer server.Close()

	client := NewClient(ClientOptions{
		APIURL:     server.URL,
		ClientKey:  "bad-key",
		HTTPClient: server.Client(),
	})
	_, err := client.Evaluate(nil)
	if err == nil || err.Error() != "Invalid client key." {
		t.Fatalf("err = %v", err)
	}
}
