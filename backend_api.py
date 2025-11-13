#!/usr/bin/env python3
"""
Backend API for Sign Language Video Conversion
Converts pose format to WebM videos and extracts text from documents
"""
import base64
import os
import re
import tempfile
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import numpy as np
import imageio.v2 as imageio
from pose_format import Pose
from pose_format.pose_visualizer import PoseVisualizer

# Document extraction
try:
    import PyPDF2
    HAS_PDF = True
except ImportError:
    HAS_PDF = False

try:
    from docx import Document
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# In-memory document storage (session-based, simple RAG)
# In production, use a proper vector database
documents = {}

API_BASE = "https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose"
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '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')

MAX_WORDS_PER_CHUNK = 250
VIDEO_MIME_TYPE = "video/webm"
POSE_API_MAX_RETRIES = 3
POSE_API_RETRY_STATUSES = {502, 503, 504}


class PoseAPIError(RuntimeError):
    """Custom exception carrying debugging details for pose API errors."""

    def __init__(
        self,
        message: str,
        *,
        status_code: Optional[int] = None,
        reason: Optional[str] = None,
        url: Optional[str] = None,
        attempts: int = 1,
        elapsed_ms: Optional[float] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.reason = reason
        self.url = url
        self.attempts = attempts
        self.elapsed_ms = elapsed_ms

    def to_dict(self) -> Dict[str, Any]:
        return {
            "message": str(self),
            "status_code": self.status_code,
            "reason": self.reason,
            "url": self.url,
            "attempts": self.attempts,
            "elapsed_ms": self.elapsed_ms,
        }

try:
    import inflect
    inflection_engine = inflect.engine()
except ImportError:
    inflection_engine = None

WORD_PATTERN = re.compile(r"\b([A-Za-z]+)\b")

try:
    from nltk.stem import PorterStemmer
    porter_stemmer = PorterStemmer()
except ImportError:
    porter_stemmer = None


def singularize_word(word: str) -> str:
    """Convert plural nouns to singular while preserving casing."""
    if not inflection_engine:
        return word

    lower_word = word.lower()
    singular = inflection_engine.singular_noun(lower_word)

    if not singular:
        return word

    if word.isupper():
        return singular.upper()
    if word[0].isupper():
        return singular.capitalize()
    return singular


def apply_casing(reference: str, word: str) -> str:
    """Apply casing while defaulting to lowercase for GLOSS-style output."""
    if not word:
        return word

    if reference.isupper():
        return word.upper()
    if reference == 'I':
        return 'I'
    return word.lower()


def postprocess_stem(original_lower: str, stem_candidate: str) -> str:
    """Tweak porter stems so they resemble natural English roots."""
    if not stem_candidate:
        return stem_candidate

    candidate = stem_candidate

    # Convert adverbs like "slowly" -> "slow" while avoiding "family" -> "fam"
    if (
        original_lower.endswith('ly')
        and not original_lower.endswith('ily')
        and candidate.endswith('li')
        and len(candidate) > 2
    ):
        candidate = candidate[:-2]

    return candidate


def normalize_word(word: str) -> Tuple[str, Dict[str, Any]]:
    """Produce singular, stemmed forms and surface the final token with debug metadata."""
    singular_candidate = singularize_word(word)
    singular_lower = singular_candidate.lower()

    stemmed_candidate_lower = (
        porter_stemmer.stem(singular_lower) if porter_stemmer else singular_lower
    )
    stemmed_candidate_lower = postprocess_stem(singular_lower, stemmed_candidate_lower)

    normalized_lower = stemmed_candidate_lower or singular_lower
    source = "stem" if stemmed_candidate_lower and stemmed_candidate_lower != singular_lower else "singular"

    normalized = apply_casing(word, normalized_lower)
    applied = normalized != word

    debug_info: Dict[str, Any] = {
        "original": word,
        "singular": singular_candidate,
        "stemmed": apply_casing(word, stemmed_candidate_lower) if stemmed_candidate_lower else singular_candidate,
        "normalized": normalized,
        "source": source,
        "applied": applied
    }
    return normalized, debug_info


def normalize_text(text: str) -> Tuple[str, List[Dict[str, Any]]]:
    """Normalize text and capture debug transformations."""
    if not text:
        return text, []

    transformations: List[Dict[str, Any]] = []

    def _replace(match: re.Match) -> str:
        word = match.group(0)
        normalized_word, debug_info = normalize_word(word)
        transformations.append(debug_info)
        return normalized_word

    normalized_text = WORD_PATTERN.sub(_replace, text)
    return normalized_text, transformations


def build_chunks(text: str, max_words: int = MAX_WORDS_PER_CHUNK) -> Tuple[List[Dict[str, Any]], str, List[Dict[str, Any]], int]:
    """Produce normalized chunks with debug information."""
    normalized_text, transformations = normalize_text(text)
    tokens = normalized_text.split()

    if not tokens:
        return [], normalized_text, transformations, 0

    chunks: List[Dict[str, Any]] = []
    transformation_index = 0
    total_transformations = len(transformations)

    for start in range(0, len(tokens), max_words):
        chunk_tokens = tokens[start:start + max_words]
        chunk_debug: List[Dict[str, Any]] = []

        for token in chunk_tokens:
            if WORD_PATTERN.fullmatch(token) and transformation_index < total_transformations:
                chunk_debug.append(transformations[transformation_index])
                transformation_index += 1
            else:
                chunk_debug.append({
                    "original": token,
                    "singular": token,
                    "stemmed": token.lower() if token else token,
                    "normalized": token,
                    "applied": False
                })

        chunks.append({
            "index": len(chunks),
            "text": " ".join(chunk_tokens),
            "word_count": len(chunk_tokens),
            "debug_words": chunk_debug
        })

    return chunks, normalized_text, transformations, len(tokens)


def fetch_pose_bytes(text: str, spoken: str = "en", signed: str = "ase") -> Tuple[bytes, Dict[str, Any]]:
    """Fetch pose data with retries and return debug metadata."""
    params = urllib.parse.urlencode({
        "text": text,
        "spoken": spoken,
        "signed": signed
    })
    url = f"{API_BASE}?{params}"

    last_error: Optional[PoseAPIError] = None

    for attempt in range(POSE_API_MAX_RETRIES):
        started = time.perf_counter()
        try:
            response = requests.get(url, timeout=60)
            elapsed_ms = (time.perf_counter() - started) * 1000
            response.raise_for_status()
            debug_info = {
                "url": url,
                "status_code": response.status_code,
                "reason": response.reason,
                "attempts": attempt + 1,
                "elapsed_ms": round(elapsed_ms, 2)
            }
            return response.content, debug_info
        except requests.HTTPError as exc:
            elapsed_ms = (time.perf_counter() - started) * 1000
            status_code = exc.response.status_code if exc.response is not None else None
            reason = exc.response.reason if exc.response is not None else str(exc)

            error = PoseAPIError(
                f"Pose API returned {status_code}",
                status_code=status_code,
                reason=reason,
                url=url,
                attempts=attempt + 1,
                elapsed_ms=round(elapsed_ms, 2)
            )

            if (
                status_code in POSE_API_RETRY_STATUSES
                and attempt < POSE_API_MAX_RETRIES - 1
            ):
                time.sleep(1.5 * (attempt + 1))
                last_error = error
                continue

            raise error from exc
        except requests.RequestException as exc:
            elapsed_ms = (time.perf_counter() - started) * 1000
            error = PoseAPIError(
                "Pose API request failed",
                reason=str(exc),
                url=url,
                attempts=attempt + 1,
                elapsed_ms=round(elapsed_ms, 2)
            )
            if attempt < POSE_API_MAX_RETRIES - 1:
                time.sleep(1.5 * (attempt + 1))
                last_error = error
                continue
            raise error from exc

    if last_error:
        raise last_error

    raise PoseAPIError("Pose API request failed for an unknown reason", url=url)

def pose_to_webm(pose_bytes: bytes, fps: int = 30, bg_color: tuple = (255, 255, 255)) -> str:
    """Convert pose bytes to a WebM video file."""
    if not pose_bytes:
        raise ValueError("No pose data provided")

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.webm')
    temp_path = temp_file.name
    temp_file.close()

    writer = imageio.get_writer(
        temp_path,
        format='FFMPEG',
        mode='I',
        fps=fps,
    codec='libvpx-vp9',
    ffmpeg_log_level='error',
    output_params=['-pix_fmt', 'yuv420p']
    )

    try:
        pose = Pose.read(pose_bytes)
        visualizer = PoseVisualizer(pose)
        frames = visualizer.draw(background_color=bg_color)
        for frame in frames:
            writer.append_data(np.asarray(frame))
    finally:
        writer.close()

    return temp_path


def encode_file_to_base64(file_path: str) -> str:
    """Read a file from disk and return a base64-encoded string."""
    with open(file_path, 'rb') as file_handle:
        return base64.b64encode(file_handle.read()).decode('utf-8')


def process_chunk_to_video(chunk: Dict[str, Any], spoken: str, signed: str, fps: int) -> Dict[str, Any]:
    """Generate a sign language video for a chunk of text."""
    result: Dict[str, Any] = {
        "index": chunk["index"],
        "text": chunk["text"],
        "word_count": chunk["word_count"],
        "debug_words": chunk["debug_words"],
        "status": "pending"
    }

    try:
        pose_bytes, pose_debug = fetch_pose_bytes(chunk["text"], spoken, signed)
        video_path = pose_to_webm(pose_bytes, fps=fps)
        try:
            result.update({
                "video_base64": encode_file_to_base64(video_path),
                "status": "success",
                "mime_type": VIDEO_MIME_TYPE,
                "pose_request": pose_debug
            })
        finally:
            os.unlink(video_path)
    except PoseAPIError as exc:
        result.update({
            "status": "error",
            "error": str(exc),
            "pose_request": exc.to_dict()
        })
    except Exception as exc:
        result.update({
            "status": "error",
            "error": str(exc),
            "pose_request": {
                "message": str(exc),
                "type": exc.__class__.__name__
            }
        })

    return result

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file."""
    if not HAS_PDF:
        raise ImportError("PyPDF2 is not installed. Install it with: pip install PyPDF2")
    
    import io
    pdf_file = io.BytesIO(file_content)
    pdf_reader = PyPDF2.PdfReader(pdf_file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() + "\n"
    return text.strip()

def extract_text_from_docx(file_content: bytes) -> str:
    """Extract text from DOCX file."""
    if not HAS_DOCX:
        raise ImportError("python-docx is not installed. Install it with: pip install python-docx")
    
    import io
    docx_file = io.BytesIO(file_content)
    doc = Document(docx_file)
    text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
    return text.strip()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "pdf_support": HAS_PDF,
        "docx_support": HAS_DOCX
    })

@app.route('/api/extract-text', methods=['POST'])
def extract_text():
    """Extract text from uploaded document (PDF, DOCX, or TXT)."""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        file_content = file.read()
        filename = file.filename.lower()
        
        if filename.endswith('.pdf'):
            if not HAS_PDF:
                return jsonify({"error": "PDF extraction not available. Install PyPDF2."}), 500
            text = extract_text_from_pdf(file_content)
        elif filename.endswith('.docx'):
            if not HAS_DOCX:
                return jsonify({"error": "DOCX extraction not available. Install python-docx."}), 500
            text = extract_text_from_docx(file_content)
        elif filename.endswith('.txt'):
            text = file_content.decode('utf-8')
        else:
            return jsonify({"error": "Unsupported file type. Use PDF, DOCX, or TXT."}), 400
        
        return jsonify({
            "text": text,
            "filename": file.filename,
            "length": len(text)
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/text-to-video', methods=['POST'])
def text_to_video():
    """Convert text to sign language video."""
    try:
        data = request.json
        text = data.get('text', '').strip()
        spoken = data.get('spoken', 'en')
        signed = data.get('signed', 'ase')
        fps = data.get('fps', 30)
        
        if not text:
            return jsonify({"error": "Text is required"}), 400
        
        chunks, normalized_text, transformations, total_words = build_chunks(text, MAX_WORDS_PER_CHUNK)

        if not chunks:
            return jsonify({"error": "Text is empty after processing"}), 400

        max_workers = min(len(chunks), 4) or 1
        chunk_results: List[Dict[str, Any]] = []

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(process_chunk_to_video, chunk, spoken, signed, fps) for chunk in chunks]
            for future in as_completed(futures):
                chunk_results.append(future.result())

        chunk_results.sort(key=lambda item: int(item["index"]))

        debug_payload = {
            "total_chunks": len(chunks),
            "max_words_per_chunk": MAX_WORDS_PER_CHUNK,
            "total_words": total_words,
            "normalized_text_preview": normalized_text[:500],
            "transformations_preview": transformations[:min(10, len(transformations))]
        }

        return jsonify({
            "videos": chunk_results,
            "debug": debug_payload
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/batch-text-to-video', methods=['POST'])
def batch_text_to_video():
    """Convert multiple text segments to videos."""
    try:
        data = request.json
        texts = data.get('texts', [])
        spoken = data.get('spoken', 'en')
        signed = data.get('signed', 'ase')
        fps = data.get('fps', 30)
        
        if not texts or not isinstance(texts, list):
            return jsonify({"error": "Texts array is required"}), 400
        
        results = []

        for idx, text in enumerate(texts):
            entry = {"index": idx, "original_text": text}
            if not text or not str(text).strip():
                entry.update({"status": "error", "error": "Empty text"})
                results.append(entry)
                continue

            try:
                chunks, normalized_text, transformations, total_words = build_chunks(str(text), MAX_WORDS_PER_CHUNK)

                if not chunks:
                    entry.update({
                        "status": "error",
                        "error": "Text is empty after processing"
                    })
                    results.append(entry)
                    continue

                max_workers = min(len(chunks), 4) or 1
                chunk_results: List[Dict[str, Any]] = []

                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    futures = [executor.submit(process_chunk_to_video, chunk, spoken, signed, fps) for chunk in chunks]
                    for future in as_completed(futures):
                        chunk_results.append(future.result())

                chunk_results.sort(key=lambda item: int(item["index"]))

                entry.update({
                    "status": "success",
                    "total_chunks": len(chunk_results),
                    "total_words": total_words,
                    "normalized_text_preview": normalized_text[:500],
                    "videos": chunk_results,
                    "transformations_preview": transformations[:min(10, len(transformations))]
                })
            except Exception as exc:
                entry.update({
                    "status": "error",
                    "error": str(exc)
                })

            results.append(entry)

        return jsonify({"results": results})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat_with_document():
    """Chat with document using RAG (Retrieval Augmented Generation)."""
    try:
        data = request.json
        question = data.get('question', '').strip()
        session_id = data.get('session_id', 'default')
        document_text = documents.get(session_id, '')
        
        if not question:
            return jsonify({"error": "Question is required"}), 400
        
        if not document_text:
            return jsonify({"error": "No document uploaded. Please upload a document first."}), 400
        
        # Simple RAG: Use document as context
        # In production, use vector embeddings and semantic search
        context = document_text[:3000] if len(document_text) > 3000 else document_text
        
        prompt = f"""You are a helpful assistant answering questions based on the provided document.

Document content:
{context}

User question: {question}

Please provide a clear, helpful answer based on the document content. If the answer is not in the document, say so."""

        # Call OpenRouter API
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {OPENROUTER_API_KEY}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'openrouter/polaris-alpha',
                'messages': [
                    {
                        'role': 'system',
                        'content': 'You are a helpful assistant that answers questions based on provided documents.'
                    },
                    {
                        'role': 'user',
                        'content': prompt
                    }
                ],
                'temperature': 0.7,
                'max_tokens': 1000,
            },
            timeout=30
        )
        
        if not response.ok:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            return jsonify({"error": f"LLM API error: {error_data.get('error', {}).get('message', 'Unknown error')}"}), 500
        
        result = response.json()
        answer = result['choices'][0]['message']['content']
        
        return jsonify({
            "answer": answer,
            "session_id": session_id
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/store-document', methods=['POST'])
def store_document():
    """Store document text for RAG."""
    try:
        data = request.json
        text = data.get('text', '').strip()
        session_id = data.get('session_id', 'default')
        
        if not text:
            return jsonify({"error": "Text is required"}), 400
        
        documents[session_id] = text
        
        return jsonify({
            "status": "success",
            "session_id": session_id,
            "length": len(text)
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

