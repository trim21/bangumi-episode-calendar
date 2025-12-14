use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use tokio::time;

use crate::config::Config;

#[async_trait::async_trait]
pub trait Cache: Send + Sync {
    async fn get_string(&self, key: &str) -> anyhow::Result<Option<String>>;
    async fn set_string(&self, key: &str, value: &str, ttl: Duration) -> anyhow::Result<()>;
}

#[derive(Clone)]
pub struct RedisCache {
    manager: redis::aio::ConnectionManager,
}

impl RedisCache {
    pub async fn connect(cfg: &Config) -> anyhow::Result<Self> {
        let connect_timeout = Duration::from_secs(5);

        // redis://[[username]:[password]@]host:port[/db]
        let mut url = String::from("redis://");
        if !cfg.redis_username.is_empty() || !cfg.redis_password.is_empty() {
            url.push_str(&urlencoding::encode(&cfg.redis_username));
            if !cfg.redis_password.is_empty() {
                url.push(':');
                url.push_str(&urlencoding::encode(&cfg.redis_password));
            }
            url.push('@');
        }
        url.push_str(&cfg.redis_addr);
        url.push('/');
        url.push_str(&cfg.redis_db.to_string());

        tracing::info!(redis_addr = %cfg.redis_addr, redis_db = cfg.redis_db, "connecting to redis");

        let client = redis::Client::open(url).context("redis client")?;
        let manager = time::timeout(connect_timeout, redis::aio::ConnectionManager::new(client))
            .await
            .context("redis connect timeout")?
            .context("redis connection manager")?;

        // Force an early round-trip so we fail fast on auth/network issues.
        let mut conn = manager.clone();
        let _pong: String =
            time::timeout(connect_timeout, redis::cmd("PING").query_async(&mut conn))
                .await
                .context("redis PING timeout")?
                .context("redis PING")?;

        Ok(Self { manager })
    }
}

#[async_trait::async_trait]
impl Cache for RedisCache {
    async fn get_string(&self, key: &str) -> anyhow::Result<Option<String>> {
        let mut conn = self.manager.clone();
        let val: Option<String> = redis::cmd("GET")
            .arg(key)
            .query_async(&mut conn)
            .await
            .context("redis GET")?;
        Ok(val)
    }

    async fn set_string(&self, key: &str, value: &str, ttl: Duration) -> anyhow::Result<()> {
        let ttl_secs = ttl.as_secs().max(1);
        let mut conn = self.manager.clone();
        redis::cmd("SET")
            .arg(key)
            .arg(value)
            .arg("EX")
            .arg(ttl_secs)
            .query_async::<()>(&mut conn)
            .await
            .context("redis SET")?;
        Ok(())
    }
}

// 仅用于测试/本地：避免依赖外部 redis。
#[derive(Default, Clone)]
pub struct MemoryCache {
    inner:
        Arc<tokio::sync::RwLock<std::collections::HashMap<String, (String, std::time::Instant)>>>,
}

#[async_trait::async_trait]
impl Cache for MemoryCache {
    async fn get_string(&self, key: &str) -> anyhow::Result<Option<String>> {
        let now = std::time::Instant::now();
        let map = self.inner.read().await;
        if let Some((v, exp)) = map.get(key) {
            if *exp > now {
                return Ok(Some(v.clone()));
            }
        }
        Ok(None)
    }

    async fn set_string(&self, key: &str, value: &str, ttl: Duration) -> anyhow::Result<()> {
        let mut map = self.inner.write().await;
        map.insert(
            key.to_string(),
            (value.to_string(), std::time::Instant::now() + ttl),
        );
        Ok(())
    }
}
