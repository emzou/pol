# this cross checks our root posts (the posts we looked for first, that have 'dei' mentions)
# then, it concats with the thread information 
# it also (optionally) lets you check if your dei_mentions are in the csv you're working with 
# i did this because the full threads associated with each dei mention may be spread across different sheets
# im unsure how work-able the full full set will be, itll be probably be really big 

import json
import pandas as pd
from bs4 import BeautifulSoup
import re

# thread json to dataframe 
with open ('thread_jun22_sep23_0_data.json', 'r') as file:
    thread_string = file.read()
data = json.loads(thread_string)

def extract_thread_data(thread_id, thread_content):
    header_soup = BeautifulSoup(thread_content['headerHTML'], 'html.parser')
    div_text_soup = BeautifulSoup(thread_content['divTextHTML'], 'html.parser')
    thread_number = thread_id
    date_time_element = header_soup.find('time')
    date = date_time_element['datetime'] if date_time_element else None
    poster_id_element = header_soup.find('span', class_='poster_hash')
    poster_id = poster_id_element.text.strip().replace('ID:', '') if poster_id_element else None
    quoted_by_element = header_soup.find('div', class_='backlink_list')
    quoted_by_links = quoted_by_element.find_all('a') if quoted_by_element else []
    quoted_bys = [link.text.strip('>>') for link in quoted_by_links]
    text = div_text_soup.get_text(strip=True)
    return {
        'Thread': thread_number,
        'No': thread_number,
        'Date': date,
        'ID': poster_id,
        'Quoted_By': quoted_bys,
        'Replied_To': [],
        'Text': text,
    }

processed_data = [extract_thread_data(thread_id, content) for thread_id, content in data.items()]
dg = pd.DataFrame(processed_data)
output_path = 'thread_jun22_sep23_0_data.csv'
dg.to_csv(output_path, index=False)


adf = pd.read_csv("11_16_myenemy.csv", index_col=None) # this is the csv of every thread reply 
dei_mentions_df = pd.read_csv("forchatdeimentionset.csv") # this is the csv with the information about posts that used the word dei 

cdf = pd.concat([dg, adf], ignore_index=True) #mash thread and post content together


# this is optional, only if the csv file isn't the full set 
cdf['No'] = cdf['No'].apply(str)
cdf['Replied_To'] = cdf['Replied_To'].apply(str)
dei_mentions_df['No'] = dei_mentions_df['No'].apply(str) #wasted 4 hours of my life figuring out this is the issue
cdlist = [m for m in cdf['No']]
deimentionlist = [m for m in dei_mentions_df['No']]
tlist = [m for m in deimentionlist if m in cdlist] # this is a list of the dei_mention post ids that are in the bigger dataframe


#make convo tree 
def build_downward_tree(post_id, df, depth=0, max_depth=None):
    if max_depth is not None and depth >= max_depth:
        return {"ID": post_id, "Replies": []}  # Stop recursion at max depth
    row = df[df['No'] == post_id]
    if row.empty:
        return {"ID": post_id, "Replies": []}  # No data found for this ID
    text = row.iloc[0]['Text'] if 'Text' in row.columns else None
    quoted_by = row.iloc[0]['Quoted_By']
    if not isinstance(quoted_by, list):
        quoted_by = eval(quoted_by) if isinstance(quoted_by, str) else []

    reply_count = len(quoted_by)
    date = row.iloc[0]['Date'] if 'Date' in row.columns else None

    # Build the tree for each quoted post
    replies = [
        build_downward_tree(reply_id, df, depth=depth + 1, max_depth=max_depth)
        for reply_id in quoted_by
    ]
    return {
        "ID": post_id,
        "Text": text,
        "Reply_Count": reply_count,
        "Replies": replies,
        "Date": date
    }

def generate_trees(root_ids, df, max_depth=6):
    return [build_downward_tree(root_id, df, depth=0, max_depth=max_depth) for root_id in root_ids]

conversation_trees = generate_trees(tlist, cdf, max_depth = 8)

filtered_conversation_trees = [
    tree for tree in conversation_trees
    if 'Text' in tree and re.search(r'\bDEI\b', tree['Text'], re.IGNORECASE)
] # get rid of the other reply parts of dei-mention posts

with open('conversation_tree_baby1.json', 'w') as f:
    json.dump(filtered_conversation_trees, f, indent=4)