import pandas as pd
from pathlib import Path 
import re
from collections import Counter
import nltk 
import string 
nltk.download('punkt')
from statistics import median
from statistics import mean
from lingua import Language, LanguageDetectorBuilder
import spacy
nlp = spacy.load("en_core_web_sm")
from transformers import pipeline
from spacy.pipeline import Sentencizer
from nltk.tokenize import sent_tokenize

# need to downgrade numpy to before 2.0 
# on windows, need to enable long paths : https://www.microfocus.com/documentation/filr/filr-4/filr-desktop/t47bx2ogpfz7.html 
# also need to do through REGEDIT on windows
## if using windows 10, add gpedit.msc this way: https://www.reddit.com/r/AnnoyingTech/comments/ojru3t/adding_gpeditmsc_on_your_windows_home/

## read in the data (if downloading from github, concat the two parts)
#df = pd.read_csv("11_6_fulldataset.csv", index_col= 0)
df1 = pd.read_csv("11_6_fulldatapart1.csv")
df2 = pd.read_csv("11_6_fulldatapart2.csv")
df= pd.concat([df1, df2], ignore_index = True) 
df['Text'] = df['Text'].str.lower()

### cleaning, processing, tagging
## categorizing quoted by 
def process_quotes(s):
    if "quoted by:" in s: 
        return re.findall(r'>>(\d+)\n', s)
    else:
        modified_string = s  # no modification needed if "Quoted By" is not present
        return "No Quote"
df['quotedby'] = df['Identifier'].apply(process_quotes)
## removing it from the text 
def stripper (s): 
    if 'Quoted By' in s:
        cleaned_string = re.sub(r'Quoted By:|>>\d+\n', '', s)
        return cleaned_string.strip()
    else: 
        return s
df ['Text'] = df['Text'].apply(stripper)
## getting the reply-to out 
df['replyto'] = df['Text'].apply(lambda text: re.findall(r'>>(\d+)', text))
df['Text'] = df['Text'].apply(lambda text: re.sub(r'>>\d+\s*', '', text).strip())
# strip website links from the text
# it means 'image of god' in latin 
sitepattern = r'(?:https?://|www\.)\S+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(?:/[^\s]*)?'
df['Text'] = df['Text'].apply(lambda text: re.sub(sitepattern, '', text).strip())
# strip 'imago dei' comments from the text
df = df[~df['Text'].str.contains('imago', case=False, na=False)]
df = df[~df['Text'].str.contains('amplissimus', case=False, na=False)]
# strip Post Reply
postpattern = r'Post\nReply'
df['Text'] = df['Text'].apply(lambda text: re.sub(postpattern, '', text).strip())

# trying to get rid of this pattern for the millionth time 
metapattern = r'.{5}(sameocrgoogleiqdbsaucenaotrace).*'
df['Text'] = df['Text'].apply(lambda text: re.sub(metapattern, '', text ).strip())

# trying to get rid of this pattern for the millionth time 
metapattern2 = r'.{5}(samegoogleiqdbsaucenaotrace).*'
df['Text'] = df['Text'].apply(lambda text: re.sub(metapattern, '', text ).strip())

# LATIN EXTERMINATION!!! 
# lingua-py (https://github.com/pemistahl/lingua-py)
languages = [Language.LATIN, Language.ENGLISH]
detector = LanguageDetectorBuilder.from_languages(*languages).build()

def latin_exterminator(s):
    confidence_value = detector.compute_language_confidence(s, Language.LATIN)
    cv = float(f"{confidence_value:.2f}") 
    if cv >= 0.5:
        return None
    else: 
        return s

#use the latin exterminator
df['Text'] = df['Text'].apply(latin_exterminator)
df = df[df['Text'].notnull()]

# drop duplicates by anon-id (this only refers to the post, not the account)
df = df.drop_duplicates(subset = 'anonid', keep = 'last')

### spacy method: 
nlp = spacy.load("en_core_web_sm", disable = ["ner", "tagger"])
def detect_sentences_spacy_pipe(text): 
    doc = nlp(text)
    return [sent.text.strip() for sent in doc.sents]

# Function to get sentence lengths using spaCy method
def spacy_sentence_lengths(text):
    sentences = detect_sentences_spacy_pipe(text)
    return [len(sentence) for sentence in sentences]

df['Spacy_Sentences'] = df['Text'].apply(detect_sentences_spacy_pipe)
df['Spacy_Sentence_Lengths'] = df['Text'].apply(spacy_sentence_lengths)

# Sentence detection with NLTK's Punkt
def nltk_sentsplit(text):
    sentences = sent_tokenize(text)
    return [sentence.strip() for sentence in sentences]

df['NLTK_Sentences'] = df['Text'].apply(nltk_sentsplit)

# Get sentence lengths with NLTK's Punkt
def nltk_sentsplit_lengths(text):
    sentences = nltk_sentsplit(text)
    return [len(sentence) for sentence in sentences]

df['NLTK_Sentence_Lengths'] = df['Text'].apply(nltk_sentsplit_lengths)

def you_a_mismatch(row):
    # Initialize a list to store sentence length tuples across methods
    sentence_lengths = []
    
    # Use zip to pair sentences from Spacy_Sentences and NLTK_Sentences by length
    for sent1, sent2 in zip(row['Spacy_Sentences'], row['NLTK_Sentences']):
        sentence_lengths.append((len(sent1), len(sent2)))
    
    # Add any extra sentences from Spacy method if longer than NLTK
    sentence_lengths += [
        (len(sent1), 0) 
        for sent1 in row['Spacy_Sentences'][len(row['NLTK_Sentences']):]
    ]
    
    # Add extra sentences from NLTK method if longer than Spacy
    sentence_lengths += [
        (0, len(sent2)) 
        for sent2 in row['NLTK_Sentences'][len(row['Spacy_Sentences']):]
    ]
    
    return sentence_lengths

# Apply this function to the DataFrame to calculate mismatches
df['Sentence_Lengths_Mismatch'] = df.apply(you_a_mismatch, axis=1)

# Display the resulting mismatches column
print(df[['Text', 'Sentence_Lengths_Mismatch']])

def count_mismatches(row):
    # Initialize mismatch counter
    mismatch_count = 0
    
    # Compare sentences between Spacy and NLTK methods
    for sent1, sent2 in zip(row['Spacy_Sentences'], row['NLTK_Sentences']):
        if sent1 != sent2:
            mismatch_count += 1
    
    # Add mismatches for any extra sentences in either method
    mismatch_count += abs(len(row['Spacy_Sentences']) - len(row['NLTK_Sentences']))
    
    return mismatch_count

# Apply the function to create a column with the total number of mismatches
df['Total_Mismatches'] = df.apply(count_mismatches, axis=1)

# Display the resulting mismatches column
print(df[['Text', 'Total_Mismatches']])

# testing performance

fdf = df[df['Total_Mismatches'] == 0]