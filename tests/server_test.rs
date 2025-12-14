use axum::Router;
use http_body_util::BodyExt;
use std::env;
use std::sync::Arc;
use tower::ServiceExt;

use bangumi_episode_calendar::{cache::MemoryCache, server, service};

#[tokio::test]
async fn test_index_page() {
    let app = build_app().await;

    let res = app
        .oneshot(
            http::Request::builder()
                .method(http::Method::GET)
                .uri("/episode-calendar")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), http::StatusCode::OK);
    let ct = res
        .headers()
        .get(http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    assert!(ct.starts_with("text/html"));
}

#[tokio::test]
async fn test_calendar_ics() {
    let app = build_app().await;
    let username = sample_username();

    let res = app
        .oneshot(
            http::Request::builder()
                .method(http::Method::GET)
                .uri(format!("/episode-calendar/{}.ics", username))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), http::StatusCode::OK);

    let ct = res
        .headers()
        .get(http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    assert!(ct.starts_with("text/calendar"));

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let body = String::from_utf8_lossy(&body);
    assert!(body.contains("Bangumi Episode Air Calendar"));
}

#[tokio::test]
async fn test_user_not_found() {
    let app = build_app().await;

    let res = app
        .oneshot(
            http::Request::builder()
                .method(http::Method::GET)
                .uri(format!(
                    "/episode-calendar/{}.ics",
                    missing_username()
                ))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), http::StatusCode::NOT_FOUND);
}

async fn build_app() -> Router {
    let cache = Arc::new(MemoryCache::default());
    let client = bangumi_episode_calendar::bangumi::Client::new(api_base_url());
    let svc = service::CalendarService::new(client, cache, 5);
    server::router(svc, false)
}

fn api_base_url() -> String {
    env::var("BANGUMI_BASE_URL").unwrap_or_else(|_| "https://api.bgm.tv".to_string())
}

fn sample_username() -> String {
    env::var("BANGUMI_TEST_USERNAME").unwrap_or_else(|_| "trim21".to_string())
}

fn missing_username() -> String {
    env::var("BANGUMI_MISSING_USERNAME")
        .unwrap_or_else(|_| "this-user-should-not-exist-ics".to_string())
}
