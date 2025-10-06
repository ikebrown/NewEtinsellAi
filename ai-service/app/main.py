
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
from typing import List
import torch
from transformers import AutoTokenizer, AutoModel
import cv2
from PIL import Image
import requests
from io import BytesIO

app = FastAPI()

# Load models
tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
model = AutoModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

class ProfileData(BaseModel):
    userId: str
    bio: str
    interests: List[str]

class MatchRequest(BaseModel):
    userProfile: ProfileData
    candidateProfiles: List[ProfileData]

class ImageModerationRequest(BaseModel):
    imageUrl: str

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}

@app.post("/api/v1/ai/match-score")
async def calculate_match_score(request: MatchRequest):
    """Calculate compatibility scores using NLP embeddings"""
    
    user_embedding = get_profile_embedding(request.userProfile)
    
    scores = []
    for candidate in request.candidateProfiles:
        candidate_embedding = get_profile_embedding(candidate)
        similarity = cosine_similarity(user_embedding, candidate_embedding)
        
        scores.append({
            "userId": candidate.userId,
            "score": float(similarity),
            "compatibility": "high" if similarity > 0.7 else "medium" if similarity > 0.5 else "low"
        })
    
    # Sort by score
    scores.sort(key=lambda x: x["score"], reverse=True)
    
    return {"matches": scores}

@app.post("/api/v1/ai/moderate-image")
async def moderate_image(request: ImageModerationRequest):
    """Moderate image for NSFW content and quality"""
    
    try:
        response = requests.get(request.imageUrl)
        img = Image.open(BytesIO(response.content))
        
        # Convert to numpy array
        img_array = np.array(img)
        
        # Basic quality checks
        quality_score = assess_image_quality(img_array)
        
        # NSFW detection (simplified - use proper model in production)
        is_appropriate = quality_score > 0.5
        
        return {
            "approved": is_appropriate,
            "qualityScore": quality_score,
            "reasons": [] if is_appropriate else ["Low quality or inappropriate content"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/ai/generate-icebreaker")
async def generate_icebreaker(profile: ProfileData):
    """Generate personalized icebreaker message"""
    
    icebreakers = [
        f"I noticed you're into {profile.interests[0] if profile.interests else 'adventure'}! What's your favorite part about it?",
        f"Your bio caught my attention! {profile.bio[:50]}... Tell me more!",
        f"Hey! I'd love to hear about your experience with {profile.interests[0] if profile.interests else 'your hobbies'}",
    ]
    
    return {"icebreaker": np.random.choice(icebreakers)}

def get_profile_embedding(profile: ProfileData):
    """Generate embedding for profile using BERT"""
    text = f"{profile.bio} {' '.join(profile.interests)}"
    
    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=128)
    
    with torch.no_grad():
        outputs = model(**inputs)
    
    # Mean pooling
    embeddings = outputs.last_hidden_state.mean(dim=1)
    return embeddings.numpy()[0]

def cosine_similarity(a, b):
    """Calculate cosine similarity between two vectors"""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def assess_image_quality(img_array):
    """Assess image quality (brightness, blur, etc.)"""
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    
    # Calculate sharpness using Laplacian variance
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    
    # Calculate brightness
    brightness = np.mean(gray)
    
    # Normalize scores
    sharpness_score = min(laplacian_var / 1000, 1.0)
    brightness_score = 1.0 - abs(brightness - 127) / 127
    
    return (sharpness_score + brightness_score) / 2

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)