use governor::{Quota, RateLimiter};
use reqwest::Client;
use std::collections::HashMap;
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum FetchError {
    #[error("Request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),
    #[error("Rate limiter error")]
    RateLimitError,
}

/// Result of a successful HTTP fetch.
#[derive(Debug, Clone)]
pub struct FetchResult {
    pub status_code: u16,
    pub body: String,
    pub headers: HashMap<String, String>,
    pub final_url: String,
}

/// HTTP fetcher with built-in rate limiting via `governor`.
pub struct RateLimitedFetcher {
    client: Client,
    limiter: Arc<RateLimiter<governor::state::NotKeyed, governor::state::InMemoryState, governor::clock::DefaultClock>>,
}

impl RateLimitedFetcher {
    /// Create a new rate-limited fetcher.
    ///
    /// - `rate_per_second`: maximum requests per second (e.g. 2)
    /// - `timeout_secs`: per-request timeout in seconds (e.g. 30)
    /// - `user_agent`: custom User-Agent header string
    pub fn new(rate_per_second: u32, timeout_secs: u64, user_agent: &str) -> Self {
        let rate = NonZeroU32::new(rate_per_second.max(1)).unwrap();
        let quota = Quota::per_second(rate);
        let limiter = Arc::new(RateLimiter::direct(quota));

        let client = Client::builder()
            .user_agent(user_agent)
            .timeout(Duration::from_secs(timeout_secs))
            .redirect(reqwest::redirect::Policy::limited(10))
            .gzip(true)
            .build()
            .expect("Failed to build HTTP client");

        RateLimitedFetcher { client, limiter }
    }

    /// Fetch a URL, waiting for rate limit clearance first.
    /// Returns a `FetchResult` with status, body, headers, and final URL (after redirects).
    pub async fn fetch(&self, url: &str) -> Result<FetchResult, FetchError> {
        // Wait for rate limiter
        self.limiter
            .until_ready()
            .await;

        let response = self.client.get(url).send().await?;

        let status_code = response.status().as_u16();
        let final_url = response.url().to_string();

        // Collect response headers
        let mut headers = HashMap::new();
        for (name, value) in response.headers().iter() {
            if let Ok(v) = value.to_str() {
                headers.insert(name.to_string(), v.to_string());
            }
        }

        let body = response.text().await?;

        Ok(FetchResult {
            status_code,
            body,
            headers,
            final_url,
        })
    }
}
