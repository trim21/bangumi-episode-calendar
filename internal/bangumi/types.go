package bangumi

import "time" // Import time

// Define Go structs corresponding to the JSON data structures returned by the Bangumi API.
// Use json struct tags for correct unmarshalling.

// UserCollectionItem represents an item in a user's collection list.
// **NOTE:** Verify the actual fields from the API. 'Type' might represent status (watching=3?).
type UserCollectionItem struct {
	Name      string    `json:"name"` // Name of the subject in the collection item itself
	SubjectID int       `json:"subject_id"`
	EpStatus  int       `json:"ep_status"` // Watched episode count
	VolStatus int       `json:"vol_status"`
	LastTouch time.Time `json:"lasttouch"` // Use time.Time with custom unmarshal if needed, or int timestamp
	User      struct {
		ID       int    `json:"id"`
		URL      string `json:"url"`
		Username string `json:"username"`
		Nickname string `json:"nickname"`
		Avatar   struct {
			Large  string `json:"large"`
			Medium string `json:"medium"`
			Small  string `json:"small"`
		} `json:"avatar"`
		Sign      string `json:"sign"`
		UserGroup int    `json:"usergroup"`
	} `json:"user"`
	Type    int            `json:"type"`    // **Crucial:** The collection status type (e.g., 1:wish, 2:collect, 3:doing/watching, 4:on_hold, 5:dropped)
	Rate    int            `json:"rate"`    // User's rating
	Private bool           `json:"private"` // Is the collection item private?
	Tag     []string       `json:"tag"`     // User tags
	Comment string         `json:"comment"` // User comment
	Subject SubjectDetails `json:"subject"` // **Important:** The API might nest subject details here! Check response.
}

// SubjectDetails represents detailed information about a specific subject (show).
// **NOTE:** Verify the actual fields from the API.
type SubjectDetails struct {
	ID       int    `json:"id"`
	URL      string `json:"url"`
	Type     int    `json:"type"` // e.g., 2 for Anime
	Name     string `json:"name"`
	NameCn   string `json:"name_cn"`
	Summary  string `json:"summary"`
	Nsfw     bool   `json:"nsfw"`
	Locked   bool   `json:"locked"`
	Date     string `json:"date"` // Airing start date (YYYY-MM-DD)
	Platform string `json:"platform"`
	Images   struct {
		Large  string `json:"large"`
		Common string `json:"common"`
		Medium string `json:"medium"`
		Small  string `json:"small"`
		Grid   string `json:"grid"`
	} `json:"images"`
	Infobox       []map[string]interface{} `json:"infobox"`        // Infobox can be complex, might need specific parsing
	Volumes       int                      `json:"volumes"`        // Manga volumes
	Eps           int                      `json:"eps"`            // Total declared episodes
	TotalEpisodes int                      `json:"total_episodes"` // Maybe redundant with 'eps'
	Rating        struct {
		Rank  int            `json:"rank"`
		Total int            `json:"total"`
		Count map[string]int `json:"count"`
		Score float64        `json:"score"`
	} `json:"rating"`
	Collection struct {
		Wish    int `json:"wish"`
		Collect int `json:"collect"`
		Doing   int `json:"doing"`
		OnHold  int `json:"on_hold"`
		Dropped int `json:"dropped"`
	} `json:"collection"`
	Tags []struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	} `json:"tags"`
	// Airing information - **CRITICAL** - These fields need verification!
	AirDate    string `json:"air_date"`    // Often same as 'date'
	AirWeekday int    `json:"air_weekday"` // Day of the week (e.g., 1 for Monday, 7 for Sunday)
	AirTime    string `json:"air_time"`    // Air time in JST (e.g., "23:30") - **Needs confirmation**
}

// Add other necessary structs based on the Bangumi API endpoints used.

// --- Structures for Processed Output ---

// AiringShow represents a single show airing on a specific date/time.
type AiringShow struct {
	SubjectID     int       `json:"subject_id"`
	Name          string    `json:"name"` // Prefer NameCn if available
	NameOriginal  string    `json:"name_original"`
	ImageURL      string    `json:"image_url"` // Use medium or common image
	SubjectURL    string    `json:"subject_url"`
	AirTimeUTC    time.Time `json:"air_time_utc"`   // Calculated next air time in UTC
	EpisodeNumber int       `json:"episode_number"` // Estimated next episode number
}

// DailySchedule groups shows airing on the same date.
type DailySchedule struct {
	Date  string       `json:"date"` // YYYY-MM-DD
	Shows []AiringShow `json:"shows"`
}

// CalendarOutput is the final structure returned by the processing function.
type CalendarOutput struct {
	GeneratedAt time.Time       `json:"generated_at"`
	User        string          `json:"user"`
	Schedule    []DailySchedule `json:"schedule"` // Sorted list of daily schedules
}
