import os
import pandas as pd
from pathlib import Path 
import re 
from lingua import Language, LanguageDetectorBuilder

directory = "data"
output_file = 'raw_merged_22_24.txt'
content_list = []

for filename in os.listdir(directory):
    if filename.endswith('.txt'):
        file_path = os.path.join(directory, filename)
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            content_list.append(content)

merged_content = '\n\n'.join(content_list)

with open(output_file, 'w', encoding='utf-8') as output:
    output.write(merged_content)

def read_file_as_string(file_path):
    text = Path(file_path).read_text(encoding='utf-8')
    return text

filepath = 'raw_merged_22_24.txt'
text = read_file_as_string(filepath)

def split_text_by_identifier_and_content(text):
    sections = []
    
    pattern_with_id = r'(\S+\s*ID:[\S]+\s+\w{3}\s+\d{2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}.*?)\s+ViewReport(.*?)(?=\s+\S+\s*ID:|\Z)'
    match_with_id = re.findall(pattern_with_id, text, flags=re.DOTALL)
    
    if match_with_id:
        for section in match_with_id:
            sections.append((section[0].strip(), section[1].strip()))
    
    pattern_without_id = r'(\w+\s+\w{3}\s+\d{2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+No\.\d+.*?)\s+ViewReport(.*?)(?=\s+\w+\s+\w{3}\s+\d{2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+No\.|\Z)'
    match_without_id = re.findall(pattern_without_id, text, flags=re.DOTALL)
    
    if match_without_id:
        for section in match_without_id:
            sections.append((section[0].strip(), section[1].strip()))
    
    return sections

def extract_and_process_replies(text):
    sections = split_text_by_identifier_and_content(text)
    
    df = pd.DataFrame(sections, columns=['Identifier', 'Text'])
    
    df['id'] = df['Identifier'].apply(lambda text: re.findall(r'ID:([^\s]+)', text)[0] if re.findall(r'ID:([^\s]+)', text) else "No ID")
    
    df['Date'] = df['Identifier'].apply(lambda text: re.findall(r'ID:\S+\s+(\S+\s+\d{2}\s+\S+\s+\d{4}\s+\d{2}:\d{2}:\d{2})', text)[0] if re.findall(r'ID:\S+\s+(\S+\s+\d{2}\s+\S+\s+\d{4}\s+\d{2}:\d{2}:\d{2})', text) else re.findall(r'(\w+\s+\w{3}\s+\d{2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2})', text)[0] if re.findall(r'(\w+\s+\w{3}\s+\d{2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2})', text) else None)
    
    df['Thread No'] = df['Identifier'].apply(lambda text: re.findall(r'No\.(\d+)', text)[0] if re.findall(r'No\.(\d+)', text) else None)
    
    df['Quoted By'] = df['Text'].apply(lambda text: re.findall(r'quoted by:\s*>>\d+', text, flags=re.IGNORECASE))
    df['Reply To'] = df['Text'].apply(lambda text: re.findall(r'>>\d+', text))
    
    df['Text'] = df['Text'].apply(lambda text: re.sub(r'quoted by:\s*>>\d+\s*', '', text, flags=re.IGNORECASE).strip())
    df['Text'] = df['Text'].apply(lambda text: re.sub(r'>>\d+\s*', '', text).strip())
    df['Text'] = df['Text'].apply(lambda text: re.sub(r'No\.\d+\s*', '', text).strip())
    
    return df

    df = pd.DataFrame(extract_and_process_replies(text))

    df.to_csv("nov12_dataset_full.csv")