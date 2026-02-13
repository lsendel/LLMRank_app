use reqwest::{Client, Response};
use std::time::Duration;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum FetchError {
    #[error("Request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),
    #[error("Status code error: {0}")]
    StatusError(u16),
}

pub struct Fetcher {
    client: Client,
}

impl Fetcher {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("LLM-Boost-Crawler/1.0 (+https://llmboost.io/bot)")
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_default();
        
        Self { client }
    }

    pub async fn fetch(&self, url: &str) -> Result<Response, FetchError> {
        let response = self.client.get(url).send().await?;
        
        if response.status().is_success() {
            Ok(response)
        } else {
            Err(FetchError::StatusError(response.status().as_u16()))
        }
    }
}
