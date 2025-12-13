use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Context;
use tokio::signal;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if has_help_flag(std::env::args()) {
        println!("Bangumi Episode Calendar server");
        return Ok(());
    }

    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cfg = bangumi_episode_calendar::config::Config::load_from_env();

    let redis_cache = bangumi_episode_calendar::cache::RedisCache::connect(&cfg)
        .await
        .context("connect redis")?;

    let svc = bangumi_episode_calendar::service::CalendarService::new(
        bangumi_episode_calendar::bangumi::Client::new(cfg.bangumi_base_url.clone()),
        Arc::new(redis_cache),
        cfg.max_concurrency,
    );

    let app = bangumi_episode_calendar::server::router(svc, cfg.enable_request_logging);

    let addr: SocketAddr = format!("{}:{}", cfg.host, cfg.port)
        .parse()
        .context("parse listen addr")?;

    tracing::info!(%addr, "server starting");

    let listener = tokio::net::TcpListener::bind(addr).await.context("bind")?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("serve")?;

    Ok(())
}

fn has_help_flag(args: impl IntoIterator<Item = String>) -> bool {
    for a in args {
        if a == "-h" || a == "--help" {
            return true;
        }
    }
    false
}

async fn shutdown_signal() {
    // SIGINT/SIGTERM
    let ctrl_c = async {
        let _ = signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(mut s) => {
                let _ = s.recv().await;
            }
            Err(e) => {
                tracing::warn!(error = %e, "failed to install SIGTERM handler");
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
