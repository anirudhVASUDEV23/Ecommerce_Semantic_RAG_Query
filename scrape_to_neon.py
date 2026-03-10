"""
scrape_to_neon.py
-----------------
Scrapes fresh Flipkart women's sports-shoes data using Selenium (headless Chrome)
and loads the results into the Neon PostgreSQL 'product' table.

Replicates the original webscraping/flipkart_data_extraction.ipynb approach.

Run locally:
    python scrape_to_neon.py

Run in GitHub Actions (headless Chrome is pre-installed):
    python scrape_to_neon.py

Env vars required:
    NEON_DATABASE_URL  — set in app/.env locally, or as a GitHub Secret in CI
"""

import asyncio
import asyncpg
import os
import re
import time
import logging
from pathlib import Path
from dotenv import load_dotenv

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

# ── Load env ──────────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent / "app" / ".env")
DATABASE_URL = os.getenv("NEON_DATABASE_URL")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
SEARCH_QUERY   = "sports shoes for women"
FLIPKART_HOME  = "https://www.flipkart.com/"
PAGES          = 25          # 25 pages × 40 products ≈ 1000 links (same as notebook)
PAGE_WAIT      = 120         # Selenium explicit wait timeout (seconds)

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS product (
    product_link  TEXT,
    title         TEXT,
    brand         TEXT,
    price         INTEGER,
    discount      FLOAT,
    avg_rating    FLOAT,
    total_ratings INTEGER
);
"""


# ── Browser factory ───────────────────────────────────────────────────────────
def get_driver() -> webdriver.Chrome:
    """Return a headless Chrome WebDriver."""
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
    # In GitHub Actions, chromedriver is on PATH; locally Chrome must be installed
    return webdriver.Chrome(options=opts)


# ── Step 1 : collect product links from search result pages ───────────────────
def collect_product_links(driver: webdriver.Chrome) -> list[str]:
    log.info("Opening Flipkart and searching for: %s", SEARCH_QUERY)
    driver.get(FLIPKART_HOME)
    driver.maximize_window()

    # Find search box and submit query
    search_input = WebDriverWait(driver, PAGE_WAIT).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, '[autocomplete="off"]'))
    )
    search_input.send_keys(SEARCH_QUERY)
    search_input.submit()

    # Wait for search results
    WebDriverWait(driver, PAGE_WAIT).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, '[target="_blank"]'))
    )

    # Build pagination links (same logic as notebook)
    first_page_el = driver.find_elements(By.CSS_SELECTOR, "nav a")[0]
    first_page_link = first_page_el.get_attribute("href")
    # Strip trailing page number and rebuild
    base_link = re.sub(r"&page=\d+$", "", first_page_link)

    all_pagination_links = [f"{base_link}&page={i}" for i in range(1, PAGES + 1)]
    log.info("Pagination links built: %d pages", len(all_pagination_links))

    # Collect all product detail page hrefs
    all_product_links: list[str] = []
    for page_link in all_pagination_links:
        driver.get(page_link)
        WebDriverWait(driver, PAGE_WAIT).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
        )
        WebDriverWait(driver, PAGE_WAIT).until(
            EC.presence_of_element_located((By.CLASS_NAME, "rPDeLR"))
        )
        products = driver.find_elements(By.CLASS_NAME, "rPDeLR")
        links = [el.get_attribute("href") for el in products]
        all_product_links.extend(links)
        log.info("  %s → %d links collected", page_link.split("page=")[-1], len(links))

    # Deduplicate
    unique_links = list(dict.fromkeys(all_product_links))
    log.info("Total unique product links: %d", len(unique_links))
    return unique_links


# ── Step 2 : visit each product page and extract details ──────────────────────
def scrape_product_details(driver: webdriver.Chrome, links: list[str]) -> list[dict]:
    complete_products: list[dict] = []
    failed = 0

    for idx, url in enumerate(links, start=1):
        try:
            driver.get(url)
            WebDriverWait(driver, PAGE_WAIT).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
            WebDriverWait(driver, PAGE_WAIT).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '[target="_blank"]'))
            )

            # Skip unavailable products
            try:
                status = driver.find_element(By.CLASS_NAME, "Z8JjpR").text
                if status in ("Currently Unavailable", "Sold Out"):
                    log.info("  URL %d skipped (unavailable)", idx)
                    continue
            except Exception:
                pass

            # ── Extract fields (exact class names from notebook) ──
            brand = driver.find_element(By.CLASS_NAME, "mEh187").text

            raw_title = driver.find_element(By.CLASS_NAME, "VU-ZEz").text
            title = re.sub(r"\s*\([^)]*\)", "", raw_title).strip()

            raw_price = driver.find_element(By.CLASS_NAME, "Nx9bqj").text
            price_digits = re.findall(r"\d+", raw_price)
            price = int("".join(price_digits)) if price_digits else None

            try:
                raw_disc = driver.find_element(By.CLASS_NAME, "UkUFwK").text
                disc_digits = re.findall(r"\d+", raw_disc)
                discount = int("".join(disc_digits)) / 100 if disc_digits else None
            except Exception:
                discount = None

            avg_rating = None
            total_ratings = None
            try:
                review_status = driver.find_element(By.CLASS_NAME, "E3XX7J").text
                if review_status == "Be the first to Review this product":
                    pass  # leave as None
            except Exception:
                try:
                    avg_rating = float(driver.find_element(By.CLASS_NAME, "XQDdHH").text)
                    raw_ratings = driver.find_element(By.CLASS_NAME, "Wphh3N").text.split(" ")[0]
                    total_ratings = int(raw_ratings.replace(",", ""))
                except Exception:
                    pass

            complete_products.append(
                {
                    "product_link": url,
                    "title": title,
                    "brand": brand,
                    "price": price,
                    "discount": discount,
                    "avg_rating": avg_rating,
                    "total_ratings": total_ratings,
                }
            )
            log.info("  URL %d/%d scraped ✓  [%s]", idx, len(links), title[:50])

        except Exception as exc:
            failed += 1
            log.warning("  URL %d failed: %s", idx, str(exc)[:120])

    log.info("Scraping complete. %d products, %d failed.", len(complete_products), failed)

    # Deduplicate by (brand, price, discount, avg_rating, total_ratings) — same as notebook
    seen = set()
    deduped = []
    for p in complete_products:
        key = (p["brand"], p["price"], p["discount"], p["avg_rating"], p["total_ratings"])
        if key not in seen:
            seen.add(key)
            deduped.append(p)

    log.info("After deduplication: %d unique products", len(deduped))
    return deduped


# ── Step 3 : load into Neon ───────────────────────────────────────────────────
async def load_to_neon(products: list[dict]) -> None:
    if not DATABASE_URL:
        raise RuntimeError(
            "NEON_DATABASE_URL is not set. "
            "Add it to app/.env locally or set it as a GitHub Secret."
        )

    log.info("Connecting to Neon PostgreSQL ...")
    conn = await asyncpg.connect(DATABASE_URL)

    await conn.execute(CREATE_TABLE_SQL)
    await conn.execute("TRUNCATE TABLE product;")
    log.info("Old data truncated.")

    rows = [
        (
            p["product_link"],
            p["title"],
            p["brand"],
            p["price"],
            p["discount"],
            p["avg_rating"],
            p["total_ratings"],
        )
        for p in products
    ]

    await conn.executemany(
        """
        INSERT INTO product
            (product_link, title, brand, price, discount, avg_rating, total_ratings)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        rows,
    )

    count = await conn.fetchval("SELECT COUNT(*) FROM product;")
    log.info("✅ Done! %d fresh rows loaded into Neon 'product' table.", count)
    await conn.close()


# ── Main ──────────────────────────────────────────────────────────────────────
async def main():
    driver = get_driver()
    try:
        links = collect_product_links(driver)
        products = scrape_product_details(driver, links)
    finally:
        driver.quit()

    if not products:
        log.error("No products scraped — aborting to avoid empty table.")
        raise SystemExit(1)

    await load_to_neon(products)


if __name__ == "__main__":
    asyncio.run(main())
