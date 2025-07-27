import pandas as pd
import sqlite3
import os
# Database and CSV file paths
db_folder=os.path.join(os.path.dirname(__file__),'..','app')
db_path =os.path.join(db_folder, 'db.sqlite')
# Ensure the 'app' directory exists
os.makedirs(db_folder, exist_ok=True)
csv_path = 'flipkart_product_data.csv'

# Connect to SQLite database (creates one if not exists)
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create the product table if it does not exist
cursor.execute('''
CREATE TABLE IF NOT EXISTS product (
    product_link TEXT,
    title TEXT,
    brand TEXT,
    price INTEGER,
    discount FLOAT,
    avg_rating FLOAT,
    total_ratings INTEGER
);
''')

# Commit the table creation
conn.commit()

# Read CSV file using pandas
df = pd.read_csv(csv_path)

# Insert data into the product table
df.to_sql('product', conn, if_exists='append', index=False)

# Close the connection
conn.close()

print("Data inserted successfully!")
