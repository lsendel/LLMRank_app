use scraper::{Html, Selector};
use url::Url;

pub struct ParsedPage {
    pub title: Option<String>,
    pub links: Vec<String>,
    pub text_content: String,
}

pub struct Parser;

impl Parser {
    pub fn parse(html_content: &str, base_url: &str) -> ParsedPage {
        let document = Html::parse_document(html_content);
        let base = Url::parse(base_url).ok();

        // Extract title
        let title_selector = Selector::parse("title").unwrap();
        let title = document
            .select(&title_selector)
            .next()
            .map(|el| el.text().collect::<String>());

        // Extract links
        let link_selector = Selector::parse("a[href]").unwrap();
        let links = document
            .select(&link_selector)
            .filter_map(|el| el.value().attr("href"))
            .filter_map(|href| {
                if let Some(base) = &base {
                    base.join(href).ok().map(|u| u.to_string())
                } else {
                    Some(href.to_string())
                }
            })
            .collect();

        // Basic text content extraction (ignoring scripts/styles)
        let body_selector = Selector::parse("body").unwrap();
        let text_content = if let Some(body) = document.select(&body_selector).next() {
            body.text().collect::<Vec<_>>().join(" ")
        } else {
            document.root_element().text().collect::<Vec<_>>().join(" ")
        };

        ParsedPage {
            title,
            links,
            text_content,
        }
    }
}
