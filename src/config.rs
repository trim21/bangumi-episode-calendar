#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,

    pub redis_addr: String,
    pub redis_db: i64,
    pub redis_username: String,
    pub redis_password: String,

    pub enable_request_logging: bool,
    pub max_concurrency: usize,

    pub bangumi_base_url: String,
}

impl Config {
    pub fn load_from_env() -> Self {
        let host = env_or("HOST", "0.0.0.0");
        let port = env_or("PORT", "3000").parse().unwrap_or(3000);

        let redis_host = env_or("REDIS_HOST", "127.0.0.1");
        let redis_port = env_or("REDIS_PORT", "6379");
        let redis_addr = format!("{}:{}", redis_host, redis_port);

        let redis_db = env_or("REDIS_DB", "0").parse().unwrap_or(0);
        let redis_username = env_or("REDIS_USERNAME", "");
        let redis_password = env_or("REDIS_PASSWORD", "");

        let enable_request_logging =
            env_or("ENABLE_REQUEST_LOGGING", "false").eq_ignore_ascii_case("true");

        let max_concurrency = env_or("MAX_CONCURRENCY", "20")
            .parse::<usize>()
            .unwrap_or(20);

        let bangumi_base_url = env_or("BANGUMI_BASE_URL", "https://api.bgm.tv")
            .trim_end_matches('/')
            .to_string();

        Self {
            host,
            port,
            redis_addr,
            redis_db,
            redis_username,
            redis_password,
            enable_request_logging,
            max_concurrency,
            bangumi_base_url,
        }
    }
}

fn env_or(key: &str, default: &str) -> String {
    match std::env::var(key) {
        Ok(v) if !v.is_empty() => v,
        _ => default.to_string(),
    }
}
