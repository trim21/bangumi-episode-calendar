use axum::response::IntoResponse;
use axum::{routing::get, Router};
use http_body_util::BodyExt;
use std::net::SocketAddr;
use std::sync::Arc;
use tower::ServiceExt;

use bangumi_episode_calendar::{cache::MemoryCache, server, service};

#[tokio::test]
async fn test_index_page() {
    let api = stub_api().await;
    let app = build_app(api).await;

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
    let api = stub_api().await;
    let app = build_app(api).await;

    let res = app
        .oneshot(
            http::Request::builder()
                .method(http::Method::GET)
                .uri("/episode-calendar/test-user.ics")
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
    let api = stub_api().await;
    let app = build_app(api).await;

    let res = app
        .oneshot(
            http::Request::builder()
                .method(http::Method::GET)
                .uri("/episode-calendar/missing.ics")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), http::StatusCode::NOT_FOUND);
}

async fn build_app(api_base: String) -> Router {
    let cache = Arc::new(MemoryCache::default());
    let client = bangumi_episode_calendar::bangumi::Client::new(api_base);
    let svc = service::CalendarService::new(client, cache, 5);
    server::router(svc, false)
}

async fn stub_api() -> String {
    let app = Router::new()
        .route("/v0/users/:username/collections", get(user_collections))
        .route("/v0/subjects/:id", get(subject))
        .route("/v0/episodes", get(episodes));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr: SocketAddr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    format!("http://{}", addr)
}

async fn user_collections(
    axum::extract::Path(username): axum::extract::Path<String>,
    axum::extract::Query(q): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl axum::response::IntoResponse {
    if username == "missing" {
        return http::StatusCode::NOT_FOUND.into_response();
    }

    let ty = q.get("type").map(|s| s.as_str()).unwrap_or("");
    if ty == "3" {
        return (
            [(http::header::CONTENT_TYPE, "application/json")],
            r#"{"data":[],"total":0,"limit":50,"offset":0}"#,
        )
            .into_response();
    }

    (
        [(http::header::CONTENT_TYPE, "application/json")],
        r#"{"data":[{"subject_id":1,"subject_type":2,"type":1,"tags":[]}],"total":1,"limit":50,"offset":0}"#,
    )
        .into_response()
}

async fn subject(
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> impl axum::response::IntoResponse {
    if id != 1 {
        return http::StatusCode::NOT_FOUND.into_response();
    }
    (
        [(http::header::CONTENT_TYPE, "application/json")],
        r#"{"name":"Subject","name_cn":"主题","id":1,"total_episodes":2}"#,
    )
        .into_response()
}

async fn episodes(
    axum::extract::Query(q): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl axum::response::IntoResponse {
    if q.get("subject_id").map(|s| s.as_str()) != Some("1") {
        return http::StatusCode::NOT_FOUND.into_response();
    }

    let airdate = (chrono::Utc::now() + chrono::Duration::days(1))
        .date_naive()
        .format("%Y-%m-%d")
        .to_string();

    let payload = format!(
        r#"{{"data":[{{"airdate":"{}","name":"E1","name_cn":"第1话","duration":"24m","sort":1,"id":11}}],"total":1,"limit":200,"offset":0}}"#,
        airdate
    );

    ([(http::header::CONTENT_TYPE, "application/json")], payload).into_response()
}
