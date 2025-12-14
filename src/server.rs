use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};

use crate::service;

static INDEX_HTML: &str = include_str!("../assets/bangumi-calendar.html");
static HOME_HTML: &str = include_str!("../assets/home.html");

#[derive(Clone)]
struct AppState {
    svc: Arc<service::CalendarService>,
}

#[derive(serde::Deserialize)]
struct IndexQuery {
    username: Option<String>,
}

pub fn router(svc: service::CalendarService, enable_logging: bool) -> Router {
    let mut app = Router::new()
        .route("/", get(home))
        .route("/episode-calendar", get(index))
        .route("/episode-calendar/{username}", get(episode_calendar))
        .with_state(AppState { svc: Arc::new(svc) });

    if enable_logging {
        app = app.layer(tower_http::trace::TraceLayer::new_for_http());
    }

    app
}

async fn home() -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        "text/html; charset=utf-8".parse().unwrap(),
    );
    (headers, Html(HOME_HTML))
}

async fn index(
    State(st): State<AppState>,
    Query(q): Query<IndexQuery>,
    headers: HeaderMap,
) -> Response {
    match q.username {
        Some(username) if !username.is_empty() => write_ics(&st, username, &headers).await,
        _ => {
            let mut headers = HeaderMap::new();
            headers.insert(
                axum::http::header::CONTENT_TYPE,
                "text/html; charset=utf-8".parse().unwrap(),
            );
            (headers, Html(INDEX_HTML)).into_response()
        }
    }
}

async fn episode_calendar(
    State(st): State<AppState>,
    Path(username): Path<String>,
    headers: HeaderMap,
) -> Response {
    if !username.ends_with(".ics") {
        return (
            StatusCode::NOT_FOUND,
            StatusCode::NOT_FOUND
                .canonical_reason()
                .unwrap_or("Not Found"),
        )
            .into_response();
    }

    let mut username = username;
    username.truncate(username.len() - 4);

    if username.is_empty() {
        return (StatusCode::BAD_REQUEST, "username is required").into_response();
    }

    write_ics(&st, username, &headers).await
}

async fn write_ics(st: &AppState, username: String, headers: &HeaderMap) -> Response {
    let content_type = if is_browser(headers) {
        "text/plain; charset=utf-8"
    } else {
        "text/calendar; charset=utf-8"
    };

    match st.svc.build_ics(&username).await {
        Ok(ics) => {
            let mut resp_headers = HeaderMap::new();
            resp_headers.insert(
                axum::http::header::CONTENT_TYPE,
                content_type.parse().unwrap(),
            );
            (resp_headers, ics).into_response()
        }
        Err(service::Error::UserNotFound) => (
            StatusCode::NOT_FOUND,
            StatusCode::NOT_FOUND
                .canonical_reason()
                .unwrap_or("Not Found"),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(username = %username, error = %e, "failed to build ics");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                StatusCode::INTERNAL_SERVER_ERROR
                    .canonical_reason()
                    .unwrap_or("Internal Server Error"),
            )
                .into_response()
        }
    }
}

fn is_browser(headers: &HeaderMap) -> bool {
    headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|ua| ua.to_lowercase().contains("mozilla"))
        .unwrap_or(false)
        || headers
            .get(axum::http::header::ACCEPT)
            .and_then(|v| v.to_str().ok())
            .map(|accept| accept.contains("text/html"))
            .unwrap_or(false)
}
