package bangumi

type Collection struct {
	SubjectID   int      `json:"subject_id"`
	SubjectType int      `json:"subject_type"`
	Type        int      `json:"type"`
	Tags        []string `json:"tags"`
}

type Subject struct {
	Name          string `json:"name"`
	NameCN        string `json:"name_cn"`
	ID            int    `json:"id"`
	TotalEpisodes int    `json:"total_episodes"`
}

type Episode struct {
	Airdate  string  `json:"airdate"`
	Name     string  `json:"name"`
	NameCN   string  `json:"name_cn"`
	Duration string  `json:"duration"`
	Sort     float64 `json:"sort"`
	ID       int     `json:"id"`
}

type Paged[T any] struct {
	Data   []T `json:"data"`
	Total  int `json:"total"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

const (
	SubjectTypeAnime   = 2
	SubjectTypeEpisode = 6
)
