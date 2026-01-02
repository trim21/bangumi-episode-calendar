use std::time::Duration;

use anyhow::Context;
use reqwest::{StatusCode, Url};
use serde::de::DeserializeOwned;
use serde::Deserialize;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("not found")]
    NotFound,

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

const USER_AGENT: &str = "trim21/bangumi-episode-calendar";

#[derive(Clone)]
pub struct Client {
    http: reqwest::Client,
    base_url: String,
}

impl Client {
    pub fn new(base_url: String) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent(USER_AGENT)
            .build()
            .expect("build reqwest client");

        Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    pub async fn get_collections(
        &self,
        username: &str,
        collection_type: i64,
        offset: i64,
        limit: i64,
    ) -> Result<Paged<Collection>, Error> {
        let url = Url::parse_with_params(
            &format!(
                "{}/v0/users/{}/collections",
                self.base_url,
                urlencoding::encode(username)
            ),
            &[
                ("type", collection_type.to_string()),
                ("offset", offset.to_string()),
                ("limit", limit.to_string()),
            ],
        )
        .context("build collections url")?;

        let res = self
            .http
            .get(url)
            .send()
            .await
            .context("send collections request")?;

        parse_json(res).await
    }

    pub async fn get_subject(&self, id: i64) -> Result<Subject, Error> {
        let url = format!("{}/v0/subjects/{}", self.base_url, id);
        let res = self
            .http
            .get(url)
            .send()
            .await
            .context("send subject request")?;

        parse_json(res).await
    }

    pub async fn get_episodes(
        &self,
        subject_id: i64,
        offset: i64,
        limit: i64,
    ) -> Result<Paged<Episode>, Error> {
        let url = Url::parse_with_params(
            &format!("{}/v0/episodes", self.base_url),
            &[
                ("subject_id", subject_id.to_string()),
                ("offset", offset.to_string()),
                ("limit", limit.to_string()),
            ],
        )
        .context("build episodes url")?;

        let res = self
            .http
            .get(url)
            .send()
            .await
            .context("send episodes request")?;

        parse_json(res).await
    }
}

async fn parse_json<T: DeserializeOwned>(res: reqwest::Response) -> Result<T, Error> {
    let status = res.status();
    if status == StatusCode::NOT_FOUND {
        return Err(Error::NotFound);
    }
    if status != StatusCode::OK {
        let body = res.text().await.unwrap_or_default();
        return Err(Error::Other(anyhow::anyhow!(
            "unexpected status {}: {}",
            status,
            body
        )));
    }

    res.json::<T>()
        .await
        .context("decode json")
        .map_err(Error::Other)
}

#[derive(Debug, Clone, Deserialize)]
pub struct Collection {
    pub subject_id: i64,
    pub subject_type: i64,
    #[serde(rename = "type")]
    pub collection_type: i64,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Subject {
    pub name: String,
    pub name_cn: String,
    pub id: i64,
    pub total_episodes: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Episode {
    pub airdate: String,
    pub name: String,
    pub name_cn: String,
    pub duration: String,
    pub sort: f64,
    pub id: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Paged<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

pub const SUBJECT_TYPE_ANIME: i64 = 2;
pub const SUBJECT_TYPE_EPISODE: i64 = 6;
