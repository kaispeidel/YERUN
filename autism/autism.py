import string
import os
from textblob import TextBlob
import google.generativeai as genai
from wordfreq import zipf_frequency

"""

    CODE EXPLANATION:
    captions are loaded from a ted talk on a text file, and simulate live captions. For now, the user
    can either continue (n), mark the line as one they struggled with (y), or exit and go straight to
    the report (exit). In a real use case, captions would come in live from the tutor or teacher and the
    only option would be to mark a line as difficult, and that line is sent to a report much like the
    one generated in this demo for the student to review at their own convenience.

"""

# Load captions from a text file
def load_captions_from_file(filename="speech.txt"):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            text = f.read()

        raw_lines = [line.strip() for line in text.splitlines() if line.strip()]
        captions = []

        for line in raw_lines:
            sublines = line.replace("!", ".").replace("?", ".").split(".")
            for sub in sublines:
                sub = sub.strip()
                if sub:
                    captions.append(sub + ".")
        return captions

    except FileNotFoundError:
        print(f"File '{filename}' not found.")
        return []

#gives the captions one by one
def get_live_caption(captions_list, index):
    if not captions_list or index >= len(captions_list):
        return None, index
    return captions_list[index], index + 1

# Sentiment Analysis (using TextBlob)
def analyze_sentiment(text):
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    if polarity < 0:
        return "Negative"
    elif polarity > 0:
        return "Positive"
    else:
        return "Neutral"

def detect_complex_words(text, freq_threshold=3.0):
    #detect complex words based on zipf frequency and length (greater than 10 = complex)
    words = [w.strip(string.punctuation) for w in text.split()]
    complex_words = set()

    for w in words:
        lw = w.lower()
        if not lw.isalpha():
            continue
        freq = zipf_frequency(lw, "en")
        if freq < freq_threshold or len(lw) > 10:
            complex_words.add(lw)
    return list(complex_words)

def analyze_text_with_complex_words(model, text, complex_words):
    #get an LLM to analyze the text, with complex words (there used to be two seperate functions, hence why 'with complex words' is specified.)
    words_str = ", ".join(complex_words) if complex_words else "None"

    prompt = f"""
        You are helping make text easier for autistic readers.

        Sentence: "{text}"

        Complex words to explain: {words_str}

        Instructions:
            1. If complex words are present, explain each in one or two short literal sentences.
            2. Provide a very short, concrete explanation (1–2 sentences) of what the sentence means.
            3. Provide a simplified version rewritten clearly and literally in one short sentence.

        Output format:
            Complex Words:
                <word explanations here, if any>
            Explanation:
                <1–2 sentence literal meaning>
            Simplified:
                <1 short simplified version>
        """
    response = model.generate_content(prompt)
    return response.text.strip() if response and hasattr(response, "text") else "(No response received)"

# User interaction (with validation)
def user_interaction(caption):
    print(f"\nCaption: {caption}")
    while True:
        user_input = input("Type 'y' if you're struggling, 'n' to move on, or 'exit' to stop: ").lower()
        if user_input in ('y', 'n', 'exit'):
            break
        print("Invalid input. Please type only 'y', 'n', or 'exit'.")
    if user_input == 'y':
        return caption
    elif user_input == 'n':
        return "n"
    elif user_input == 'exit':
        return "EXIT"
    return None

# Generate a report (step-by-step output)
def generate_report(problematic_texts):
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    if not GOOGLE_API_KEY:
        print("No Google API key found. Please set GOOGLE_API_KEY as an environment variable.")
        return

    # Configure LLM
    genai.configure(api_key=GOOGLE_API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')

    print("\n--- End of Session Report ---")
    for idx, text in enumerate(problematic_texts, 1):
        # Sentiment analysis
        sentiment = analyze_sentiment(text)
        print(f"\nProblematic Text {idx}:")
        print(f"Text: {text}")
        print(f"Sentiment: {sentiment}")

        # Detect complex words in the sentence
        complex_words = detect_complex_words(text)
        if complex_words:
            print("\nDetected complex words:", ", ".join(complex_words))
        else:
            complex_words = []

        # Call single integrated LLM function
        print("\nAutism-Aware Summary:")
        try:
            summary_output = analyze_text_with_complex_words(model, text, complex_words)
            print(summary_output)
        except Exception as e:
            print(f"(LLM analysis failed: {e})")

        # Pause before moving to the next sentence
        input("\nPress Enter to continue to the next entry...")

    print("\nEnd of report.")

def main():
    print("Loading Autism Caption Assistant...")
    problematic_texts = []
    captions = load_captions_from_file("speech.txt")
    caption_index = 0
    print("Starting Autism Caption Assistant...")

    while True:
        caption, caption_index = get_live_caption(captions, caption_index)
        if caption is None:
            print("\nEnd of captions reached.")
            break

        result = user_interaction(caption)

        if result == "EXIT":
            break
        elif result == "n":
            continue
        elif result:
            problematic_texts.append(result)

    if problematic_texts:
        generate_report(problematic_texts)
    else:
        print("\nNo issues in understanding the text.")

if __name__ == "__main__":
    main()
