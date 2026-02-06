from semantic_router import Route, SemanticRouter
from semantic_router.encoders import HuggingFaceEncoder
# from semantic_router.encoders import VoyageEncoder
from dotenv import load_dotenv
import os

encoder = HuggingFaceEncoder(name="sentence-transformers/all-MiniLM-L6-v2")
load_dotenv()
# print(os.getenv("VOYAGE_API_KEY"))
# encoder = VoyageEncoder(name="voyage-2")

faq = Route(
    name="faq",
    score_threshold=0.4,
    utterances=[
        # Existing utterances
        "What is the return policy of the products?",
        "Do I get discount with HDFC credit card?",
        "How can I track my order?",
        "What payment methods are accepted?",
        "How long does it take to process a refund?",

        # New, similar utterances focusing on various aspects of FAQs
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
        "What if my item arrives damaged?"
    ]
)

sql = Route(
    name="sql",
    score_threshold=0.4,
    utterances=[
        "I want to buy nike shoes that have 50% discount",
        "Are there any shoes under 3000",
        "Do you formal shoes in size 9",
        "Are there any Puma shoes on sale?",
        "What is the price of puma running shoes?"
    ]
)

routes_1 = [sql]
routes_2=[faq]

# Corrected Initialization:
# 1. Initialize SemanticRouter with only the encoder
router = SemanticRouter(encoder=encoder)
# 2. Explicitly add the routes to the router's index
router.add(routes=routes_1)
router.add(routes=routes_2)


if __name__ == "__main__":
    print(router("What is the return policy of the products").name)
    print(router("Pink Puma Shoes in range of 5000 to 10000").name)