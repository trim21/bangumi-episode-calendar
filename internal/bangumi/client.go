package bangumi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var ErrNotFound = errors.New("not found")

const userAgent = "trim21/bangumi-episode-calendar"

type Client struct {
	httpClient *http.Client
	baseURL    string
}

func NewClient(baseURL string) *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		baseURL:    strings.TrimSuffix(baseURL, "/"),
	}
}

func (c *Client) GetCollections(ctx context.Context, username string, collectionType, offset, limit int) (*Paged[Collection], error) {
	endpoint := fmt.Sprintf("%s/v0/users/%s/collections", c.baseURL, url.PathEscape(username))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	q := req.URL.Query()
	q.Set("type", strconv.Itoa(collectionType))
	q.Set("offset", strconv.Itoa(offset))
	q.Set("limit", strconv.Itoa(limit))
	req.URL.RawQuery = q.Encode()
	setCommonHeaders(req)

	body, status, err := c.do(req)
	if err != nil {
		return nil, err
	}

	if status == http.StatusNotFound {
		return nil, ErrNotFound
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d: %s", status, string(body))
	}

	var res Paged[Collection]
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetSubject(ctx context.Context, id int) (*Subject, int, error) {
	endpoint := fmt.Sprintf("%s/v0/subjects/%d", c.baseURL, id)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, 0, err
	}
	setCommonHeaders(req)

	body, status, err := c.do(req)
	if err != nil {
		return nil, 0, err
	}
	if status == http.StatusNotFound {
		return nil, status, ErrNotFound
	}
	if status != http.StatusOK {
		return nil, status, fmt.Errorf("unexpected status %d: %s", status, string(body))
	}

	var res Subject
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, status, err
	}
	return &res, status, nil
}

func (c *Client) GetEpisodes(ctx context.Context, subjectID, offset, limit int) (*Paged[Episode], error) {
	endpoint := fmt.Sprintf("%s/v0/episodes", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	q := req.URL.Query()
	q.Set("subject_id", strconv.Itoa(subjectID))
	q.Set("offset", strconv.Itoa(offset))
	q.Set("limit", strconv.Itoa(limit))
	req.URL.RawQuery = q.Encode()
	setCommonHeaders(req)

	body, status, err := c.do(req)
	if err != nil {
		return nil, err
	}
	if status == http.StatusNotFound {
		return nil, ErrNotFound
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d: %s", status, string(body))
	}

	var res Paged[Episode]
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) do(req *http.Request) ([]byte, int, error) {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return body, resp.StatusCode, nil
}

func setCommonHeaders(req *http.Request) {
	req.Header.Set("User-Agent", userAgent)
}
