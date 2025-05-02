from flask import Flask, render_template, request, jsonify, Response, session
import cv2
import google.generativeai as genai
import os
from PIL import Image
import base64
import io
import numpy as np
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///recipes.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Database Models
class Recipe(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    ingredients = db.Column(db.Text, nullable=False)
    steps = db.Column(db.Text, nullable=False)
    prep_time = db.Column(db.String(20))
    cook_time = db.Column(db.String(20))
    difficulty = db.Column(db.String(20))
    servings = db.Column(db.Integer)
    nutrition = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class UserPreference(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50))
    preferences = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Configure the Gemini API
GOOGLE_API_KEY = "AIzaSyD74CzOVX_y3g7GK5uIJzKlzR_qx0v2WSo"
genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

# Global webcam object
camera = None

def get_camera():
    global camera
    if camera is None:
        camera = cv2.VideoCapture(0)
    return camera

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/scan_ingredients')
def scan_ingredients():
    return render_template('scan_ingredients.html')

@app.route('/suggest_dish')
def suggest_dish():
    return render_template('suggest_dish.html')

@app.route('/recipe/<int:recipe_id>')
def show_recipe(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    return render_template('recipe.html', recipe=recipe)

@app.route('/recipe/ingredients/<recipe_id>')
def recipe_ingredients(recipe_id):
    return render_template('recipe_ingredients.html')

@app.route('/recipe/cooking/<recipe_id>')
def recipe_cooking(recipe_id):
    return render_template('recipe_cooking.html')

def gen_frames():
    camera = get_camera()
    while True:
        success, frame = camera.read()
        if not success:
            break
        else:
            ret, buffer = cv2.imencode('.jpg', frame)
            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/capture_frame', methods=['GET'])
def capture_frame():
    camera = get_camera()
    success, frame = camera.read()
    if success:
        # Convert the frame to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        # Convert to PIL Image
        img = Image.fromarray(frame_rgb)
        # Save to bytes
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG')
        img_byte_arr = img_byte_arr.getvalue()
        # Convert to base64
        img_base64 = base64.b64encode(img_byte_arr).decode()
        return jsonify({'success': True, 'image': f'data:image/jpeg;base64,{img_base64}'})
    return jsonify({'success': False, 'error': 'Failed to capture frame'})

@app.route('/process_image', methods=['POST'])
def process_image():
    try:
        image_data = request.json['image']
        preferences = request.json.get('preferences', '')
        image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        
        image = Image.open(io.BytesIO(image_bytes))
        
        # Generate content with Gemini
        prompt = f"""
        Analyze this image and list all the ingredients you can see. Then, suggest 3 possible recipes 
        that can be made using these ingredients, considering the following preferences: {preferences}
        Also consider that common pantry items (salt, sugar, spices, etc.) are available.
        
        For each recipe, format it EXACTLY as follows (do not include the recipe number in the name):
        
        1. **[Recipe Name]**
        **Brief description:** [A brief description of the dish]
        **Key ingredients needed:** [List main ingredients, separated by commas]
        **Difficulty level:** [Easy/Medium/Hard]
        **Cooking time:** [Estimated time]
        **Step-by-step instructions:**
        1. [First step]
        2. [Second step]
        3. [Continue steps...]
        **Nutritional information (per serving):** Calories: [amount], Protein: [amount]g, Carbs: [amount]g, Fat: [amount]g
        
        Start with:
        
        Detected Ingredients:
        - [list each ingredient on a new line with a dash]
        
        Suggested Recipes:
        [Then list the 3 recipes in the format above]
        """
        
        response = model.generate_content([prompt, image])
        return jsonify({'success': True, 'result': response.text})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/get_recipe_suggestions', methods=['POST'])
def get_recipe_suggestions():
    try:
        preferences = request.json['preferences']
        prompt = f"""
        Based on the following preferences: "{preferences}"
        Suggest 3 recipes that match these criteria. Format each recipe EXACTLY as follows (do not include the recipe number in the name):

        1. **[Recipe Name]**
        **Brief description:** [A brief description of the dish]
        **Key ingredients needed:** [List main ingredients, separated by commas]
        **Difficulty level:** [Easy/Medium/Hard]
        **Cooking time:** [Estimated time]
        **Step-by-step instructions:**
        1. [First step]
        2. [Second step]
        3. [Continue steps...]
        **Nutritional information (per serving):** Calories: [amount], Protein: [amount]g, Carbs: [amount]g, Fat: [amount]g
        """
        
        response = model.generate_content(prompt)
        return jsonify({'success': True, 'result': response.text})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/ask_question', methods=['POST'])
def ask_question():
    try:
        question = request.json['question']
        recipe_id = request.json['recipe_id']
        recipe = Recipe.query.get(recipe_id)
        
        if not recipe:
            return jsonify({'success': False, 'error': 'Recipe not found'})
        
        prompt = f"""
        Based on the following recipe information, answer this question: {question}
        
        Recipe Name: {recipe.name}
        Ingredients: {recipe.ingredients}
        Steps: {recipe.steps}
        """
        
        response = model.generate_content(prompt)
        return jsonify({'success': True, 'answer': response.text})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/save_preferences', methods=['POST'])
def save_preferences():
    try:
        preferences = request.json['preferences']
        user_id = session.get('user_id', 'anonymous')
        
        new_preference = UserPreference(
            user_id=user_id,
            preferences=preferences
        )
        
        db.session.add(new_preference)
        db.session.commit()
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/get_alternatives', methods=['POST'])
def get_alternatives():
    try:
        ingredients = request.json['ingredients']
        
        # Generate alternatives for each ingredient using Gemini
        alternatives = {}
        for ingredient in ingredients:
            prompt = f"""
            Suggest 4 common alternative ingredients that can be used instead of {ingredient} in cooking.
            Consider alternatives that:
            1. Have similar culinary function
            2. Are commonly available in stores
            3. Can work as direct substitutes
            4. Have similar flavor profiles or cooking properties

            Format your response as a simple comma-separated list of alternatives.
            Example format: alt1, alt2, alt3, alt4
            """
            
            response = model.generate_content(prompt)
            alternatives[ingredient] = [alt.strip() for alt in response.text.split(',')]
        
        return jsonify({'success': True, 'alternatives': alternatives})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/suggest_recipes', methods=['POST'])
def suggest_recipes():
    try:
        data = request.json
        selected_ingredients = data.get('ingredients', [])
        preferences = data.get('preferences', '')
        
        # Generate prompt for recipe suggestions
        prompt = f"""
        Based on these ingredients:
        {', '.join(selected_ingredients)}
        
        And these preferences:
        {preferences}
        
        Suggest 3 possible recipes that can be made. Consider that common pantry items (salt, pepper, oil, etc.) are available.
        
        Format each recipe EXACTLY as follows:
        
        1. **[Recipe Name]**
        **Brief description:** [A brief description of the dish]
        **Key ingredients needed:** [List main ingredients, separated by commas]
        **Difficulty level:** [Easy/Medium/Hard]
        **Cooking time:** [Estimated time]
        **Step-by-step instructions:**
        1. [First step]
        2. [Second step]
        3. [Continue steps...]
        **Nutritional information (per serving):** Calories: [amount], Protein: [amount]g, Carbs: [amount]g, Fat: [amount]g
        """
        
        response = model.generate_content(prompt)
        return jsonify({'success': True, 'result': response.text})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.teardown_appcontext
def cleanup(exception):
    global camera
    if camera is not None:
        camera.release()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
