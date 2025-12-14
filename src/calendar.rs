use chrono::{Datelike, Timelike, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SlimSubject {
    pub name: String,
    pub id: i64,
    pub future_episodes: Vec<ParsedEpisode>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ParsedEpisode {
    pub id: i64,
    pub sort: f64,
    pub name: String,
    pub air_date: [i32; 3],
    pub duration: String,
}

#[derive(Debug, Clone)]
struct Event {
    subject_id: i64,
    episode_id: i64,
    start: String,
    end: String,
    summary: String,
    description: String,
}

const NAMESPACE: &str = "ef2256c4-162e-446b-9ccf-81050809d0c9";

pub fn render_ics(subjects: &[SlimSubject]) -> String {
    let mut cal = ICalendar::new(
        "Bangumi Episode Air Calendar",
        [
            ("X-PUBLISHED-TTL", "PT8H"),
            ("REFRESH-INTERVAL;VALUE=DURATION", "PT8H"),
        ],
    );

    let now = Utc::now();
    let max_ts = now.timestamp() + 30 * 24 * 60 * 60;

    for subject in subjects {
        for ep in &subject.future_episodes {
            let start_date = chrono::NaiveDate::from_ymd_opt(
                ep.air_date[0],
                ep.air_date[1] as u32,
                ep.air_date[2] as u32,
            );
            let Some(start_date) = start_date else {
                continue;
            };

            let start_dt = start_date.and_hms_opt(0, 0, 0).unwrap();
            if start_dt.and_utc().timestamp() > max_ts {
                continue;
            }

            let end_date = start_date.succ_opt().unwrap_or(start_date);

            let mut description_parts = vec![format!("https://bgm.tv/ep/{}", ep.id)];
            if !ep.name.is_empty() {
                description_parts.push(ep.name.clone());
            }
            if !ep.duration.is_empty() {
                description_parts.push(format!("时长：{}", ep.duration));
            }
            let description = description_parts.join("\\n");

            cal.add_event(Event {
                subject_id: subject.id,
                episode_id: ep.id,
                start: format_date_array(ep.air_date),
                end: format_date(end_date),
                summary: format!("{} {}", subject.name, ep.sort),
                description,
            });
        }
    }

    cal.finish()
}

struct ICalendar {
    now: chrono::DateTime<Utc>,
    lines: Vec<String>,
}

impl ICalendar {
    fn new(name: &str, meta: impl IntoIterator<Item = (&'static str, &'static str)>) -> Self {
        let mut lines = vec![
            "BEGIN:VCALENDAR".to_string(),
            "VERSION:2.0".to_string(),
            "PRODID:-//trim21//bangumi-icalendar//CN".to_string(),
            format!("NAME:{}", name),
            format!("X-WR-CALNAME:{}", name),
        ];
        for (k, v) in meta {
            lines.push(format!("{}:{}", k, v));
        }
        Self {
            now: Utc::now(),
            lines,
        }
    }

    fn add_event(&mut self, e: Event) {
        self.lines.push("BEGIN:VEVENT".to_string());
        self.lines.push(format!(
            "UID:{}",
            generate_uid(&format!(
                "subject-{}-episode-{}",
                e.subject_id, e.episode_id
            ))
        ));
        self.lines
            .push(format!("DTSTAMP:{}", format_datetime(self.now)));
        self.lines.push(format!("DTSTART;VALUE=DATE:{}", e.start));
        self.lines.push(format!("DTEND;VALUE=DATE:{}", e.end));
        self.lines.push(format!("SUMMARY:{}", e.summary));
        if !e.description.is_empty() {
            self.lines.push(format!("DESCRIPTION:{}", e.description));
        }
        self.lines.push("END:VEVENT".to_string());
    }

    fn finish(self) -> String {
        // Go 版本：strings.Join(lines, "\n") + "\nEND:VCALENDAR"
        let mut out = self.lines.join("\n");
        out.push_str("\nEND:VCALENDAR");
        out
    }
}

fn format_date_array(d: [i32; 3]) -> String {
    format!("{:04}{:02}{:02}", d[0], d[1], d[2])
}

fn format_date(d: chrono::NaiveDate) -> String {
    format!("{:04}{:02}{:02}", d.year(), d.month(), d.day())
}

fn format_datetime(d: chrono::DateTime<Utc>) -> String {
    format!(
        "{:04}{:02}{:02}T{:02}{:02}{:02}Z",
        d.year(),
        d.month(),
        d.day(),
        d.hour(),
        d.minute(),
        d.second()
    )
}

fn generate_uid(summary: &str) -> String {
    let ns = Uuid::parse_str(NAMESPACE).expect("valid uuid namespace");
    Uuid::new_v5(&ns, summary.as_bytes()).to_string()
}
