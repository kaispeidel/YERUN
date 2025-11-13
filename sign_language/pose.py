# app.py
import os, json, shutil, tempfile, urllib.parse, time, re
from itertools import islice

import numpy as np
import requests
import streamlit as st
import imageio.v2 as imageio  # imageio==2.x

from PIL import Image as PILImage, ImageDraw, ImageFont

from pose_format import Pose
from pose_format.pose_visualizer import PoseVisualizer, FastAndUglyPoseVisualizer

# Optional: plural→singular engine
try:
    import inflect
    _inflect = inflect.engine()
except Exception:
    _inflect = None

st.set_page_config(page_title="LLM → Real-time Signed Skeleton (Lemma Debug)", page_icon="🤟", layout="centered")
API_BASE = "https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose"

# ---------------- Utilities ----------------

def has_ffmpeg() -> bool:
    return bool(shutil.which("ffmpeg") or shutil.which("ffmpeg.exe"))

@st.cache_data(show_spinner=False)
def fetch_pose_bytes(text: str, spoken: str, signed: str) -> bytes:
    q = f"?text={urllib.parse.quote(text)}&spoken={urllib.parse.quote(spoken)}&signed={urllib.parse.quote(signed)}"
    url = f"{API_BASE}{q}"
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    return r.content

def rgb_to_gray(r, g, b) -> int:
    return int(0.299*r + 0.587*g + 0.114*b)

def make_frames_gen(pose_bytes: bytes, use_fast: bool, bg_rgb: tuple[int,int,int]):
    """Return an iterator of frames; auto-fallback from OpenCV fast renderer to PIL renderer."""
    p = Pose.read(pose_bytes)
    if use_fast:
        try:
            vis = FastAndUglyPoseVisualizer(p)
            return vis.draw(background_color=rgb_to_gray(*bg_rgb))  # grayscale int
        except Exception:
            vis = PoseVisualizer(p)
            return vis.draw(background_color=bg_rgb)
    else:
        vis = PoseVisualizer(p)
        return vis.draw(background_color=bg_rgb)

def overlay_text(arr: np.ndarray, text: str, box=True) -> np.ndarray:
    """Overlay debug text on a frame (Pillow path, avoids cv2.line type issues)."""
    img = PILImage.fromarray(arr)
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()
    pad = 6
    text = text if len(text) <= 160 else text[:157] + "…"
    x0, y0, x1, y1 = draw.textbbox((0, 0), text, font=font)
    w, h = x1, y1
    if box:
        draw.rectangle([5, 5, 5 + w + 2*pad, 5 + h + 2*pad], fill=(0, 0, 0, 160))
    draw.text((5 + pad, 5 + pad), text, fill=(255, 255, 255), font=font)
    return np.asarray(img)

def stream_to_mp4_open(fps: int, quiet: bool = True):
    """Open an MP4 writer (no duplicate -pix_fmt; quiet logs)."""
    path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4").name
    kw = dict(format="FFMPEG", mode="I", fps=fps, codec="libx264")
    if quiet:
        kw["ffmpeg_log_level"] = "error"
    writer = imageio.get_writer(path, **kw)
    return writer, path

def flush_frames_to(writer, frames_iter, preview_slot, debug_overlay_text=None):
    """Append frames to MP4 writer & update the preview; return frame count."""
    count = 0
    for fr in frames_iter:
        arr = np.asarray(fr)
        if debug_overlay_text:
            arr = overlay_text(arr, debug_overlay_text)
        writer.append_data(arr)
        if preview_slot is not None:
            preview_slot.image(arr, clamp=True)
        count += 1
    return count

def frames_to_gif(frames_iter, fps: int, debug_overlay_text=None) -> str:
    frames = []
    for fr in frames_iter:
        arr = np.asarray(fr)
        if debug_overlay_text:
            arr = overlay_text(arr, debug_overlay_text)
        frames.append(arr)
    if not frames:
        raise RuntimeError("No frames were produced from the pose.")
    path = tempfile.NamedTemporaryFile(delete=False, suffix=".gif").name
    imageio.mimsave(path, frames, format="GIF", duration=1.0 / max(fps, 1))
    return path

# ---------------- Text Normalization (plural→singular) ----------------

_WORD_OR_SPACE_OR_PUNCT = re.compile(r"\w+|\s+|[^\w\s]")

def _singularize_word_en(word: str) -> str:
    """
    Best-effort English plural→singular.
    Uses `inflect` if available; falls back to simple rules.
    Keeps original casing (Title/Upper/Lower).
    """
    orig = word
    low = word.lower()

    # inflect is pretty good at deciding if it's a plural noun
    if _inflect is not None:
        s = _inflect.singular_noun(orig)
        # singular_noun returns False if not plural; else returns singular form (string)
        if isinstance(s, str) and s:
            return _restore_case(s, orig)

    # Heuristic fallback (only if it "looks" plural and not a common false-positive)
    if len(low) > 3:
        if low.endswith("ies"):
            s = low[:-3] + "y"
            return _restore_case(s, orig)
        for suf in ("sses", "ches", "shes", "xes", "zes"):
            if low.endswith(suf):
                s = low[:-2]  # remove only 'es'
                return _restore_case(s, orig)
    if low.endswith("s") and not low.endswith(("ss", "us", "is")):
        s = low[:-1]
        return _restore_case(s, orig)

    return orig

def _restore_case(s: str, template: str) -> str:
    if template.isupper():
        return s.upper()
    if template.istitle():
        return s.capitalize()
    if template.islower():
        return s.lower()
    # Mixed case: keep s as-is
    return s

def normalize_text_en(text: str, *, singularize_nouns: bool, lowercase_all: bool) -> tuple[str, bool]:
    """
    Token-preserving normalization:
      - if singularize_nouns: plural→singular per token (English nouns)
      - if lowercase_all: force tokens to lowercase
    Returns (normalized_text, changed?)
    """
    changed = False
    out = []
    for tok in _WORD_OR_SPACE_OR_PUNCT.findall(text):
        if tok.isalpha():  # word
            new_tok = tok
            if singularize_nouns:
                sg = _singularize_word_en(new_tok)
                if sg != new_tok:
                    new_tok = sg
                    changed = True
            if lowercase_all:
                low = new_tok.lower()
                if low != new_tok:
                    new_tok = low
                    changed = True
            out.append(new_tok)
        else:
            out.append(tok)
    norm = "".join(out)
    return norm, (changed or norm != text)

# ---------------- LLM Streaming (Ollama; optional) ----------------

def build_system_prompt(style: str, ask_for_base_forms: bool):
    base = ""
    if ask_for_base_forms:
        base = "Use base (dictionary) forms for nouns and simple present verbs when possible. "
    if style == "Natural (recommended)":
        return (
            "Convert the user's request into short, sign-friendly NATURAL-LANGUAGE clauses. "
            + base +
            "Avoid gloss. Keep normal casing. Use simple, declarative phrases. "
            "Separate clauses with ' | '. "
            "Example: 'Why do rabbits eat carrots?' -> 'Rabbits eat carrots. | Why do rabbits eat carrots?'"
        )
    else:  # Gloss
        return (
            "Convert the user's request into short GLOSS-style clauses in ALL CAPS. "
            + base +
            "Separate clauses with ' | '. "
            "Example: 'Why do rabbits eat carrots?' -> 'RABBIT EAT CARROT WHY | '"
        )

def llm_stream_ollama(prompt: str, model: str = "llama3.2", host="http://localhost:11434", system=""):
    """Yield text chunks from a local free LLM as they arrive."""
    url = f"{host}/api/chat"
    payload = {
        "model": model,
        "stream": True,
        "messages": [
            {"role":"system","content": system},
            {"role":"user","content": prompt}
        ]
    }
    with requests.post(url, json=payload, stream=True, timeout=120) as r:
        r.raise_for_status()
        for line in r.iter_lines():
            if not line:
                continue
            try:
                j = json.loads(line.decode("utf-8"))
            except Exception:
                continue
            msg = j.get("message", {}).get("content")
            if msg:
                yield msg
            if j.get("done"):
                break

def segment_stream(text_chunks, delimiters="|.!?\n"):
    """Accumulate streamed text and yield a segment each time a delimiter appears."""
    buf = ""
    for chunk in text_chunks:
        buf += chunk
        emitted = True
        while emitted:
            emitted = False
            idxs = [buf.find(d) for d in delimiters if buf.find(d) != -1]
            if idxs:
                i = min(idxs)
                seg, buf = buf[:i].strip(), buf[i+1:]
                if seg:
                    yield seg
                emitted = True
    if buf.strip():
        yield buf.strip()

# ---------------- UI ----------------

st.title("LLM → Real-time Signed Skeleton (Lemma Debug) 🎥")
st.caption("Normalize plural nouns (rabbits→rabbit) before calling the pose API to avoid fingerspelling.")

with st.sidebar:
    st.subheader("Translation")
    spoken_lang = st.text_input("Spoken language code", value="en")
    signed_lang = st.text_input("Signed language code", value="ase", help="Example: ase = ASL")

    st.subheader("Text normalization (English)")
    singularize_nouns = st.checkbox("Singularize plural nouns", value=True,
                                    help="e.g., rabbits→rabbit, carrots→carrot (uses 'inflect' if installed)")
    lowercase_all = st.checkbox("Force lowercase before sending", value=False)
    ask_llm_for_base_forms = st.checkbox("Ask LLM for base forms (nouns/verbs)", value=True)

    st.subheader("Rendering")
    fps = st.slider("FPS", 10, 60, 30, 2)
    fast_mode = st.checkbox("Try fast renderer (OpenCV, grayscale)", value=False)
    bg_hex = st.color_picker("Background", value="#FFFFFF")
    bg_rgb = tuple(int(bg_hex[i:i+2], 16) for i in (1,3,5))

    st.subheader("LLM (optional)")
    use_llm = st.checkbox("Use local LLM (Ollama)", value=False)
    clause_style = st.radio("Clause style", ["Natural (recommended)", "Gloss"], index=0)
    ollama_model = st.text_input("Ollama model", value="llama3.2")

    st.subheader("Debug")
    debug_mode = st.checkbox("Enable debug panel & overlay", value=True)
    show_clause_status = st.checkbox("Show clause status lines", value=True)

    st.markdown("---")
    if not has_ffmpeg():
        st.info("FFmpeg not detected. MP4 may fail.\nInstall FFmpeg or `pip install imageio-ffmpeg` (bundles a binary).")

user_text = st.text_area("Say/ask what you want signed:", value="Why do rabbits eat carrots?")
col1, col2 = st.columns(2)
go = col1.button("Generate (stream)", type="primary")
clear = col2.button("Clear")

if "logs" not in st.session_state:
    st.session_state.logs = []

def log(msg):
    if debug_mode:
        st.session_state.logs.append(f"{time.strftime('%H:%M:%S')}  {msg}")
        if len(st.session_state.logs) > 500:
            st.session_state.logs = st.session_state.logs[-500:]

if clear:
    st.session_state.logs = []
    st.experimental_rerun()

# ---------------- Action ----------------

if go:
    if not user_text.strip():
        st.warning("Please enter some text.")
    else:
        preview = st.empty()
        status = st.status("Starting …", expanded=False)
        try:
            writer, mp4_path = stream_to_mp4_open(fps, quiet=True)
            total_frames = 0
            t0 = time.time()

            with status:
                system_prompt = build_system_prompt(clause_style, ask_for_base_forms=ask_llm_for_base_forms)
                status.update(label="Producing clauses …", state="running")

                stream = None
                if use_llm:
                    try:
                        stream = llm_stream_ollama(user_text, model=ollama_model, system=system_prompt)
                        log(f"LLM model: {ollama_model}")
                        log(f"System prompt style: {clause_style}; ask_base_forms={ask_llm_for_base_forms}")
                    except Exception as e:
                        log(f"LLM unavailable: {e} → single-shot fallback")

                def normalize_for_api(text_in: str) -> tuple[str, bool]:
                    """Apply selected text normalizations before calling the API."""
                    norm, changed = normalize_text_en(
                        text_in,
                        singularize_nouns=singularize_nouns,
                        lowercase_all=lowercase_all,
                    )
                    return norm, changed

                def process_unit(text_unit: str, unit_idx: int) -> int:
                    """Send one text unit, render frames, return number of frames appended."""
                    original = text_unit.strip()

                    # If clause style is Gloss, keep it (can trigger fingerspelling); else Natural.
                    send_text = original.upper() if clause_style == "Gloss" else original

                    # Normalize (rabbits→rabbit, etc.)
                    send_text_norm, changed = normalize_for_api(send_text)
                    if changed:
                        log(f"[{unit_idx}] Norm: '{send_text}' → '{send_text_norm}'")
                    else:
                        log(f"[{unit_idx}] Norm: (no change) '{send_text}'")

                    unit_t0 = time.time()
                    pb = fetch_pose_bytes(send_text_norm, spoken_lang, signed_lang)
                    unit_ms = int((time.time() - unit_t0) * 1000)
                    log(f"[{unit_idx}] To API: '{send_text_norm}' | spoken={spoken_lang} signed={signed_lang} | .pose bytes={len(pb)} | {unit_ms}ms")

                    frames = make_frames_gen(pb, use_fast=fast_mode, bg_rgb=bg_rgb)
                    overlay = (f"Clause {unit_idx}: {send_text_norm}" if debug_mode else None)
                    count = flush_frames_to(writer, frames, preview, debug_overlay_text=overlay)
                    log(f"[{unit_idx}] Frames appended: {count}")
                    return count

                if stream is not None:
                    pass
                    idx = 1
                    for clause in segment_stream(stream):
                        if show_clause_status:
                            status.update(label=f"Clause {idx}: {clause}", state="running")
                        total_frames += process_unit(clause, idx)
                        idx += 1
                else:
                    status.update(label="Translating full text …", state="running")
                    total_frames += process_unit(user_text, 1)

            writer.close()
            elapsed = int((time.time() - t0))
            if total_frames == 0:
                st.error("No frames were produced. Try different input, choose Natural clause style, or adjust normalization.")
            else:
                status.update(label="Done!", state="complete")
                st.success(f"Generated MP4: {total_frames} frames @ {fps} FPS (in {elapsed}s)")
                st.video(mp4_path)
                with open(mp4_path, "rb") as f:
                    st.download_button("Download MP4", f.read(), "skeleton_stream.mp4", "video/mp4")

        except requests.HTTPError as e:
            st.error(f"API error: {e.response.status_code} — {e.response.text[:200]}...")
        except Exception as e:
            st.error(f"Unexpected error: {e}")

# ---------------- Debug Panel ----------------
if debug_mode and st.session_state.logs:
    st.markdown("### Debug log")
    st.code("\n".join(st.session_state.logs))
