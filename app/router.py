from semantic_router import Route, SemanticRouter
from semantic_router.encoders.huggingface import HuggingFaceEncoder
from dotenv import load_dotenv
import os

encoder = HuggingFaceEncoder(name="sentence-transformers/all-MiniLM-L6-v2")
load_dotenv()

faq = Route(
    name="faq",
    score_threshold=0.4,
    utterances=[
        "What is the return policy of the products?",
        "Do I get discount with HDFC credit card?",
        "How can I track my order?",
        "What payment methods are accepted?",
        "How long does it take to process a refund?",
        "Can I return an item after 30 days?",
        "What are the steps for exchanging a product?",
        "Do you offer free shipping?",
        "How much does delivery cost?",
        "When will my order arrive?",
        "What is the estimated delivery time?",
        "How do I change my shipping address?",
        "Is cash on delivery available?",
        "What credit cards do you accept?",
        "My payment failed, what should I do?",
        "How do I cancel an order?",
        "Can I modify my order after it's placed?",
        "How do I contact customer support?",
        "Where can I find my order history?",
        "What if my item arrives damaged?",
    ],
)

sql = Route(
    name="sql",
    score_threshold=0.4,
    utterances=[
        "I want to buy nike shoes that have 50% discount",
        "Are there any shoes under 3000",
        "Do you formal shoes in size 9",
        "Are there any Puma shoes on sale?",
        "What is the price of puma running shoes?",
        "Give me 5 top rated products",
        "Show me the best selling items",
        "List all products under 5000 rupees",
        "Do you have any discounts on ladies shoes?",
        "Sort products by price high to low",
        "What are the cheapest options available?",
        "I am looking for a gift under 2000",
        "Show me products with rating above 4",
    ],
)

contextual = Route(
    name="contextual",
    score_threshold=0.35,
    utterances=[
        # Referring to previous product(s)
        "Is this a sports shoe?",
        "Is this good for running?",
        "What brand is this?",
        "Is this a good option?",
        "Which one would you recommend?",
        "Tell me more about this product",
        "Is this available in other colors?",
        "What are the features of this?",
        # Comparative follow-ups from a list
        "Which one is the cheapest from the above?",
        "Show me the cheapest one from these",
        "Which one has the highest discount?",
        "Which one is the best rated?",
        "Which one is better?",
        "Can you compare these two?",
        "Which one should I buy?",
        # Pronoun-heavy follow-ups
        "Tell me more about the first one",
        "What is the rating of the second one?",
        "Is the discounted one worth buying?",
        "Is that a good shoe?",
        "Are those running shoes?",
        "How is that compared to the others?",
    ],
)

router = SemanticRouter(encoder=encoder)
router.add(routes=[sql, faq, contextual])


if __name__ == "__main__":
    print(router("What is the return policy of the products").name)
    print(router("Pink Puma Shoes in range of 5000 to 10000").name)
    print(router("Is this a sports shoe?").name)
    print(router("Which one has the highest discount?").name)
