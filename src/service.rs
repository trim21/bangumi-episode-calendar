use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use futures::StreamExt;
use chrono::Datelike;

use crate::bangumi;
use crate::cache::Cache;
use crate::calendar;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("user not found")]
    UserNotFound,

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

const ICS_CACHE_PREFIX: &str = "episode-calendar-v5.0-";
const SUBJECT_CACHE_PREFIX: &str = "subject-v3-";

const EP_PAGE_SIZE: i64 = 200;
const COLLECTION_PAGE_SIZE: i64 = 50;

const ICS_CACHE_TTL: Duration = Duration::from_secs(23 * 60 * 60);
const SUBJECT_SHORT_TTL: Duration = Duration::from_secs(3 * 24 * 60 * 60);
const SUBJECT_LONG_TTL: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const NOT_FOUND_SUBJECT_TTL: Duration = Duration::from_secs(24 * 60 * 60);

#[derive(Clone)]
pub struct CalendarService {
    client: bangumi::Client,
    cache: Arc<dyn Cache>,
    max_concurrency: usize,
}

impl CalendarService {
    pub fn new(client: bangumi::Client, cache: Arc<dyn Cache>, max_concurrency: usize) -> Self {
        let max_concurrency = if max_concurrency == 0 {
            20
        } else {
            max_concurrency
        };
        Self {
            client,
            cache,
            max_concurrency,
        }
    }

    pub async fn build_ics(&self, username: &str) -> Result<String, Error> {
        let cache_key = format!("{}{}", ICS_CACHE_PREFIX, username);
        if let Some(cached) = self.cache.get_string(&cache_key).await? {
            return Ok(cached);
        }

        let collections = self.fetch_all_user_collection(username).await?;
        let subjects = self.fetch_subjects(collections).await?;

        let ics = calendar::render_ics(&subjects);
        if let Err(e) = self.cache.set_string(&cache_key, &ics, ICS_CACHE_TTL).await {
            tracing::warn!(error = %e, "failed to set ics cache");
        }

        Ok(ics)
    }

    async fn fetch_all_user_collection(
        &self,
        username: &str,
    ) -> Result<Vec<bangumi::Collection>, Error> {
        let mut data = Vec::new();
        for collection_type in [1_i64, 3_i64] {
            let mut offset = 0_i64;
            loop {
                let res = match self
                    .client
                    .get_collections(username, collection_type, offset, COLLECTION_PAGE_SIZE)
                    .await
                {
                    Ok(v) => v,
                    Err(bangumi::Error::NotFound) => {
                        return Err(Error::UserNotFound);
                    }
                    Err(e) => return Err(Error::Other(anyhow::Error::new(e))),
                };

                for c in res.data {
                    if c.subject_type == bangumi::SUBJECT_TYPE_ANIME
                        || c.subject_type == bangumi::SUBJECT_TYPE_EPISODE
                    {
                        data.push(c);
                    }
                }

                offset += COLLECTION_PAGE_SIZE;
                if offset >= res.total {
                    break;
                }
            }
        }
        Ok(data)
    }

    async fn fetch_subjects(
        &self,
        collections: Vec<bangumi::Collection>,
    ) -> Result<Vec<calendar::SlimSubject>, Error> {
        let ids = unique_subject_ids(&collections);
        let results = futures::stream::iter(ids)
            .map(|id| {
                let svc = self.clone();
                async move { svc.get_subject_info(id).await }
            })
            .buffer_unordered(self.max_concurrency)
            .collect::<Vec<_>>()
            .await;

        let mut out = Vec::new();
        for r in results {
            let subject = r?;
            if let Some(s) = subject {
                if !s.future_episodes.is_empty() {
                    out.push(s);
                }
            }
        }
        Ok(out)
    }

    async fn get_subject_info(
        &self,
        subject_id: i64,
    ) -> Result<Option<calendar::SlimSubject>, Error> {
        let cache_key = format!("{}{}", SUBJECT_CACHE_PREFIX, subject_id);
        if let Some(raw) = self.cache.get_string(&cache_key).await? {
            match serde_json::from_str::<Option<calendar::SlimSubject>>(&raw) {
                Ok(cached) => return Ok(cached),
                Err(e) => tracing::debug!(error = %e, "ignore invalid subject cache"),
            }
        }

        let subject = match self.client.get_subject(subject_id).await {
            Ok(v) => v,
            Err(bangumi::Error::NotFound) => {
                if let Ok(payload) = serde_json::to_string(&Option::<calendar::SlimSubject>::None) {
                    let _ = self
                        .cache
                        .set_string(&cache_key, &payload, NOT_FOUND_SUBJECT_TTL)
                        .await;
                }
                return Ok(None);
            }
            Err(e) => return Err(Error::Other(anyhow::Error::new(e))),
        };

        let mut data = calendar::SlimSubject {
            id: subject.id,
            name: fallback_name([subject.name_cn.as_str(), subject.name.as_str()]),
            future_episodes: Vec::new(),
        };

        if subject.total_episodes > 0 {
            let all_episodes = self.fetch_all_episode(subject_id).await?;
            let future = filter_future_episodes(&all_episodes);

            if !all_episodes.is_empty()
                && future.is_empty()
                && (all_episodes.len() as i64) <= EP_PAGE_SIZE
            {
                data.future_episodes = future;
                if let Ok(payload) = serde_json::to_string(&Some(data.clone())) {
                    let _ = self
                        .cache
                        .set_string(&cache_key, &payload, SUBJECT_LONG_TTL)
                        .await;
                }
                return Ok(Some(data));
            }

            data.future_episodes = future;
        }

        if let Ok(payload) = serde_json::to_string(&Some(data.clone())) {
            let _ = self
                .cache
                .set_string(&cache_key, &payload, SUBJECT_SHORT_TTL)
                .await;
        }

        Ok(Some(data))
    }

    async fn fetch_all_episode(
        &self,
        subject_id: i64,
    ) -> Result<Vec<calendar::ParsedEpisode>, Error> {
        let mut data = Vec::new();
        let mut offset = 0_i64;
        loop {
            let res = self
                .client
                .get_episodes(subject_id, offset, EP_PAGE_SIZE)
                .await
                .map_err(|e| Error::Other(anyhow::Error::new(e)))?;

            for ep in res.data {
                if let Some(parsed) = parse_episode(ep) {
                    data.push(parsed);
                }
            }

            offset += EP_PAGE_SIZE;
            if offset >= res.total {
                break;
            }
        }
        Ok(data)
    }
}

fn parse_episode(ep: bangumi::Episode) -> Option<calendar::ParsedEpisode> {
    let parts: Vec<&str> = ep.airdate.split('-').collect();
    if parts.len() != 3 {
        return None;
    }

    let y: i32 = parts[0].trim().parse().ok()?;
    let m: i32 = parts[1].trim().parse().ok()?;
    let d: i32 = parts[2].trim().parse().ok()?;

    Some(calendar::ParsedEpisode {
        id: ep.id,
        sort: ep.sort,
        name: html_unescape([ep.name_cn.as_str(), ep.name.as_str()]),
        air_date: [y, m, d],
        duration: ep.duration,
    })
}

fn month_start_with_offset(date: chrono::NaiveDate, offset: i32) -> Option<chrono::NaiveDate> {
    let start = date.with_day(1)?;
    if offset >= 0 {
        start.checked_add_months(chrono::Months::new(offset as u32))
    } else {
        start.checked_sub_months(chrono::Months::new(offset.unsigned_abs()))
    }
}

fn filter_future_episodes(episodes: &[calendar::ParsedEpisode]) -> Vec<calendar::ParsedEpisode> {
    let today = chrono::Utc::now().date_naive();
    let current_month_start = today.with_day(1).unwrap();
    let Some(prev_month_start) = month_start_with_offset(current_month_start, -1) else {
        return Vec::new();
    };
    let Some(month_after_next_start) = month_start_with_offset(current_month_start, 2) else {
        return Vec::new();
    };
    episodes
        .iter()
        .filter_map(|ep| {
            let date = chrono::NaiveDate::from_ymd_opt(
                ep.air_date[0],
                ep.air_date[1] as u32,
                ep.air_date[2] as u32,
            )?;
            (date >= prev_month_start && date < month_after_next_start).then(|| ep.clone())
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn include_previous_current_and_next_month() {
        let today = chrono::Utc::now().date_naive();
        let current_month_start = today.with_day(1).unwrap();
        let prev_month_start = month_start_with_offset(current_month_start, -1).unwrap();
        let next_month_start = month_start_with_offset(current_month_start, 1).unwrap();
        let month_after_next_start = month_start_with_offset(current_month_start, 2).unwrap();

        let episodes = vec![
            parsed_episode(prev_month_start, 1.0, 1),
            parsed_episode(current_month_start, 2.0, 2),
            parsed_episode(
                next_month_start + chrono::Duration::days(5),
                3.0,
                3,
            ),
            parsed_episode(month_after_next_start, 4.0, 4),
            parsed_episode(prev_month_start - chrono::Duration::days(1), 5.0, 5),
        ];

        let filtered = filter_future_episodes(&episodes);
        let ids: Vec<i64> = filtered.into_iter().map(|ep| ep.id).collect();

        assert_eq!(ids, vec![1, 2, 3]);
    }

    fn parsed_episode(date: chrono::NaiveDate, sort: f64, id: i64) -> calendar::ParsedEpisode {
        calendar::ParsedEpisode {
            id,
            sort,
            name: String::new(),
            air_date: [date.year(), date.month() as i32, date.day() as i32],
            duration: String::new(),
        }
    }
}

fn fallback_name<'a>(values: impl IntoIterator<Item = &'a str>) -> String {
    for v in values {
        if !v.trim().is_empty() {
            return v.to_string();
        }
    }
    String::new()
}

fn unique_subject_ids(collections: &[bangumi::Collection]) -> Vec<i64> {
    let mut set = HashSet::new();
    for c in collections {
        set.insert(c.subject_id);
    }
    set.into_iter().collect()
}

fn html_unescape<'a>(values: impl IntoIterator<Item = &'a str>) -> String {
    for v in values {
        if !v.is_empty() {
            return html_unescape_single(v);
        }
    }
    String::new()
}

fn html_unescape_single(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}
