根据在看和想看条目生成日历。

https://workers.trim21.me/episode-calendar

## 运行

- 本地运行：`cargo run`
- Docker：`docker build -t bangumi-episode-calendar .`

## 接口

- `/`：首页
- `/episode-calendar`：HTML 表单（或带 `?username=` 时直接返回 ICS）
- `/episode-calendar/{username}.ics`：返回 iCalendar

## 环境变量

- `HOST`（默认 `0.0.0.0`）
- `PORT`（默认 `3000`）
- `REDIS_HOST`（默认 `127.0.0.1`）
- `REDIS_PORT`（默认 `6379`）
- `REDIS_DB`（默认 `0`）
- `REDIS_USERNAME` / `REDIS_PASSWORD`
- `ENABLE_REQUEST_LOGGING`（默认 `false`）
- `MAX_CONCURRENCY`（默认 `20`）
- `BANGUMI_BASE_URL`（默认 `https://api.bgm.tv`）
