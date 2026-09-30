package pennant

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// EvaluationContext matches POST /api/client/evaluate context fields.
type EvaluationContext struct {
	UserID        string            `json:"userId,omitempty"`
	SessionID     string            `json:"sessionId,omitempty"`
	RemoteAddress string            `json:"remoteAddress,omitempty"`
	Hostname      string            `json:"hostname,omitempty"`
	Properties    map[string]string `json:"properties,omitempty"`
}

// FlagEvaluation is one flag result.
type FlagEvaluation struct {
	Enabled bool   `json:"enabled"`
	Variant string `json:"variant,omitempty"`
}

// FlagMap maps flag keys to evaluations.
type FlagMap map[string]FlagEvaluation

// ClientOptions configures the evaluate client.
type ClientOptions struct {
	APIURL      string
	ClientKey   string
	Environment string
	Project     string
	Context     EvaluationContext
	HTTPClient  *http.Client
}

// Client evaluates flags against a Pennant server.
type Client struct {
	apiURL      string
	clientKey   string
	environment string
	project     string
	context     EvaluationContext
	httpClient  *http.Client
	flags       FlagMap
}

type evaluateRequest struct {
	Context     EvaluationContext `json:"context"`
	Environment string            `json:"environment"`
	Project     string            `json:"project,omitempty"`
}

type evaluateResponse struct {
	Flags FlagMap `json:"flags"`
	Error string  `json:"error,omitempty"`
}

// NewClient builds a Pennant evaluate client.
func NewClient(opts ClientOptions) *Client {
	env := opts.Environment
	if env == "" {
		env = "development"
	}
	httpClient := opts.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		apiURL:      strings.TrimRight(opts.APIURL, "/"),
		clientKey:   opts.ClientKey,
		environment: env,
		project:     opts.Project,
		context:     opts.Context,
		httpClient:  httpClient,
		flags:       FlagMap{},
	}
}

// Evaluate POSTs to /api/client/evaluate.
func (c *Client) Evaluate(ctx *EvaluationContext) (FlagMap, error) {
	context := c.context
	if ctx != nil {
		context = *ctx
	}
	payload := evaluateRequest{
		Context:     context,
		Environment: c.environment,
		Project:     c.project,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, c.apiURL+"/api/client/evaluate", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.clientKey)

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	var parsed evaluateResponse
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &parsed); err != nil {
			return nil, err
		}
	}
	if res.StatusCode >= 400 {
		if parsed.Error != "" {
			return nil, fmt.Errorf("%s", parsed.Error)
		}
		return nil, fmt.Errorf("evaluation failed (%d)", res.StatusCode)
	}
	if parsed.Flags == nil {
		parsed.Flags = FlagMap{}
	}
	c.flags = parsed.Flags
	return parsed.Flags, nil
}

// Flags returns the last evaluate result.
func (c *Client) Flags() FlagMap {
	return c.flags
}

// IsEnabled reports whether a flag is on in the last result.
func (c *Client) IsEnabled(key string) bool {
	flag, ok := c.flags[key]
	return ok && flag.Enabled
}

// GetVariant returns the sticky variant from the last result.
func (c *Client) GetVariant(key string) string {
	return c.flags[key].Variant
}

// IsEnabledIn reports enabled from a flag map.
func IsEnabledIn(flags FlagMap, key string) bool {
	flag, ok := flags[key]
	return ok && flag.Enabled
}

// GetVariantIn returns the variant from a flag map.
func GetVariantIn(flags FlagMap, key string) string {
	return flags[key].Variant
}
