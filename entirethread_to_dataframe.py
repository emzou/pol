# this takes the json file we made with entire thread contents, and turns it into a dataframe 
# updated as of 11/16/2024 8:25PM. listening to feeling good nina simone. 
# just kidding i was but now im listening to league of legends music

import json
import pandas as pd
import re

with open('{json_name}', 'r') as file:
    json_literal_string = file.read()
data = json.loads(json_literal_string)

df = pd.DataFrame([(key, item) for key, values in data.items() for item in values], columns=['Thread', 'Content'])
df['ID'] = df['Content'].str.extract(r'^\S+ ID:([\w\d]+)')
df['No'] = df['Content'].str.extract(r'\bNo\.(\d+)\b')
df['Date'] = df['Content'].str.extract(r'\b(\w{3} \d{1,2} \w{3} \d{4} \d{2}:\d{2}:\d{2})\b')
df['Literal'] = df['Content'].apply(repr)
df['LosingIt'] = df['Literal'].str.split('Report', n=1).str[1]
df['OnlyQuotes'] = df['LosingIt'].apply(lambda x: x if 'Quoted By' in x else [])
df['Quoted'] = df['OnlyQuotes'].apply(lambda x: re.search(r'(\\n.*?\\n)', x).group(0) if x.count('\\n') > 1 else "")
df['Quoted_By'] = df['Quoted'].apply(lambda x: re.findall(r'>>(\d+)', x))
df['Reply1'] = df.apply(lambda row: row['LosingIt'].replace(row['Quoted'], ''), axis=1)
df['Replied_To'] = df['Reply1'].apply(lambda x: re.findall(r'>>(\d+)', x))
df['Text'] = df['Content'].apply(lambda x: x.split("\n")[-1])

def ensure_thread_in_replied_to(row):
    replied_to = row['Replied_To']  
    if not replied_to or (isinstance(replied_to, list) and len(replied_to) == 0):  
        return [row['Thread']]  
    return replied_to  

df['Replied_To'] = df.apply(ensure_thread_in_replied_to, axis=1)

# exploding the dataframe so each element is are separate replies to posts
df_exploded = df.explode('Replied_To', ignore_index=True)

# get reply ids 
def extract_the_text_from_reply1(row):
    if pd.isnull(row['Replied_To']) or pd.isnull(row['Reply1']):
        return row['Reply1']  
    pattern = rf">>{row['Replied_To']}(.*?)(?=(>>\d+|$))"
    match = re.search(pattern, row['Reply1'], re.DOTALL)
    if match:
        return match.group(1).strip()
    return row['Reply1']  

df_exploded['The_Text'] = df_exploded.apply(extract_the_text_from_reply1, axis=1)


df_exploded = df_exploded[['Thread', 'ID', 'No', 'Date', 'Quoted_By', 'Replied_To', 'Reply1', 'Text', 'The_Text', 'Literal']]
df_exploded.to_csv("11_16_myenemy.csv") #lol ive had arcane on in the background