// Camera handling
let video = document.getElementById('webcam');
let canvas = document.getElementById('canvas');
let startButton = document.getElementById('startCamera');
let captureButton = document.getElementById('captureImage');
let uploadButton = document.getElementById('uploadImage');
let fileInput = document.getElementById('fileInput');
let stream = null;
let webcamContainer = document.getElementById('camera-container');
let capturedImageContainer = document.getElementById('captured-image');
let outputImage = document.getElementById('output');

if (startButton) {
    startButton.addEventListener('click', async () => {
        try {
            // Request access to the default camera
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user', // This ensures we use the built-in camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            if (!video) {
                throw new Error('Video element not found');
            }
            
            video.srcObject = stream;
            await video.play();
            startButton.disabled = true;
            captureButton.disabled = false;
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Could not access camera. Please make sure you have granted camera permissions and that your webcam is properly connected.');
        }
    });
}

if (captureButton) {
    captureButton.addEventListener('click', async () => {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to image
        const imageData = canvas.toDataURL('image/jpeg');
        outputImage.src = imageData;
        
        // Stop video stream and hide video element
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        
        // Show captured image
        webcamContainer.style.display = 'none';
        capturedImageContainer.style.display = 'block';
        
        // Process the image and get results
        try {
            const response = await fetch('/process_image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData
                })
            });
            
            const data = await response.json();
            if (data.success) {
                const resultContent = document.getElementById('resultContent');
                
                // Format ingredients as checkboxes in a grid
                const ingredientsHTML = `
                    <div class="ingredients-grid">
                        ${data.result.split('\n')
                            .filter(line => line.trim().startsWith('-'))
                            .map((line, index) => {
                                const ingredient = line.replace('-', '').trim();
                                return `
                                    <div class="ingredient-item">
                                        <input type="checkbox" 
                                               id="ingredient${index}" 
                                               class="ingredient-checkbox">
                                        <label for="ingredient${index}" 
                                               class="ingredient-label">
                                            ${ingredient}
                                        </label>
                                    </div>`;
                            })
                            .join('')}
                    </div>`;
                
                // Show only the ingredients section initially
                resultContent.innerHTML = ingredientsHTML;
                document.getElementById('results').style.display = 'block';

                // Handle Next button click
                document.getElementById('nextButton').addEventListener('click', () => {
                    // Get selected ingredients
                    const selectedIngredients = Array.from(document.querySelectorAll('.ingredient-checkbox:checked'))
                        .map(checkbox => checkbox.nextElementSibling.textContent.trim());
                    
                    if (selectedIngredients.length === 0) {
                        alert('Please select at least one ingredient');
                        return;
                    }

                    // Store selected ingredients in sessionStorage
                    sessionStorage.setItem('selectedIngredients', JSON.stringify(selectedIngredients));
                    
                    // Show preferences section
        document.getElementById('preferences').style.display = 'block';
                    document.getElementById('preferencesText').focus();
                });

                // Handle Suggest Recipes button click
                document.getElementById('suggestRecipes').addEventListener('click', async () => {
                    const preferences = document.getElementById('preferencesText').value.trim();
                    const selectedIngredients = JSON.parse(sessionStorage.getItem('selectedIngredients') || '[]');
                    
                    if (!preferences) {
                        alert('Please enter your preferences');
                        return;
                    }

                    try {
                        const response = await fetch('/suggest_recipes', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                ingredients: selectedIngredients,
                                preferences: preferences
                            })
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            // Format and display recipes
                            const recipes = data.result
                                .split(/\d+\.\s+\*\*/)
                                .slice(1)
                                .map(recipe => {
                                    // Parse recipe data
                                    const recipeData = parseRecipe(recipe);
                                    const recipeId = 'recipe_' + Math.random().toString(36).substr(2, 9);
                                    
                                    // Store recipe data for later use
                                    sessionStorage.setItem(recipeId, JSON.stringify(recipeData));
                                    
                                    // Return formatted HTML
                                    return `
                                        <div class="recipe-card" data-recipe-id="${recipeId}">
                                            <div class="recipe-card-header">
                                                <h3>${recipeData.name}</h3>
                                            </div>
                                            <div class="recipe-card-content">
                                                <div class="recipe-section">
                                                    <div class="recipe-description">${recipeData.description}</div>
                                                </div>
                                                <div class="recipe-section">
                                                    <div class="recipe-section-title">Ingredients</div>
                                                    <div class="recipe-ingredients">
                                                        ${recipeData.ingredients.map(ing => 
                                                            `<span class="recipe-ingredient-tag">${ing}</span>`
                                                        ).join('')}
                                                    </div>
                                                </div>
                                                <div class="recipe-section">
                                                    <div class="recipe-meta">
                                                        <div class="recipe-meta-item">
                                                            <span class="recipe-meta-label">Difficulty:</span>
                                                            <span>${recipeData.difficulty}</span>
                                                        </div>
                                                        <div class="recipe-meta-item">
                                                            <span class="recipe-meta-label">Time:</span>
                                                            <span>${recipeData.cookingTime}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                });

                            // Display recipes and show the section
                            document.getElementById('recipeContent').innerHTML = recipes.join('');
                            document.getElementById('recipeResults').style.display = 'block';

                            // Add click handlers to recipe cards
                            document.querySelectorAll('.recipe-card').forEach(card => {
                                card.addEventListener('click', function() {
                                    const recipeId = this.dataset.recipeId;
                                    const recipeData = JSON.parse(sessionStorage.getItem(recipeId));
                                    if (recipeData) {
                                        // Store the recipe data again to ensure it's fresh
                                        sessionStorage.setItem(recipeId, JSON.stringify(recipeData));
                                        // Redirect to ingredients page
                                        window.location.href = `/recipe/ingredients/${recipeId}`;
                                    }
                                });
                            });
                        } else {
                            alert('Error: ' + data.error);
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        alert('An error occurred while getting recipe suggestions');
                    }
                });
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while processing the image');
        }
        
        // Reset buttons
        startButton.disabled = false;
        captureButton.disabled = true;
    });
}

if (uploadButton) {
    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                outputImage.src = e.target.result;
                webcamContainer.style.display = 'none';
                capturedImageContainer.style.display = 'block';
                document.getElementById('preferences').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.style.display = 'none';
        captureButton.style.display = 'none';
    }
}

function processImage(imageData) {
    document.getElementById('preferences').style.display = 'block';
    let output = document.getElementById('output');
    output.src = imageData;
    output.style.display = 'block';
}

// Recipe generation
const generateRecipes = document.getElementById('generateRecipes');
if (generateRecipes) {
    generateRecipes.addEventListener('click', async () => {
        const preferences = document.getElementById('preferencesText').value;
        const imageData = document.getElementById('output').src;
        
        try {
            const response = await fetch('/process_image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData,
                    preferences: preferences
                })
            });
            
            const data = await response.json();
            if (data.success) {
                const resultContent = document.getElementById('resultContent');
                
                // Format ingredients as checkboxes in a grid
                const ingredientsHTML = `
                    <div class="ingredients-grid">
                        ${data.result.split('\n')
                            .filter(line => line.trim().startsWith('-'))
                            .map((line, index) => {
                                const ingredient = line.replace('-', '').trim();
                                return `
                                    <div class="ingredient-item">
                                        <input type="checkbox" 
                                               id="ingredient${index}" 
                                               class="ingredient-checkbox">
                                        <label for="ingredient${index}" 
                                               class="ingredient-label">
                                            ${ingredient}
                                        </label>
                                    </div>`;
                            })
                            .join('')}
                    </div>`;
                
                // Format recipes
                const recipes = data.result
                    .split(/\d+\.\s+\*\*/)
                    .slice(1)
                    .map(recipe => formatRecipe(recipe));

                // Combine everything
                resultContent.innerHTML = `
                    <h5>Detected Ingredients:</h5>
                    ${ingredientsHTML}
                    <div class="recipe-section mt-4">
                        <h5>Suggested Recipes:</h5>
                        ${recipes.join('')}
                    </div>
                `;

                // Show results
                document.getElementById('results').style.display = 'block';
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while processing the request');
        }
    });
}

// Dish suggestions
const getSuggestions = document.getElementById('getSuggestions');
if (getSuggestions) {
    getSuggestions.addEventListener('click', async () => {
        const preferences = document.getElementById('dishPreferences').value;
        
        try {
            const response = await fetch('/get_recipe_suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    preferences: preferences
                })
            });
            
            const data = await response.json();
            if (data.success) {
                // Split the recipes exactly like scan ingredients page
                const recipes = data.result
                    .split(/\d+\.\s+\*\*/)
                    .slice(1) // Remove the empty first element
                    .map(recipe => `1. **${recipe.trim()}`); // Add back number and ** to maintain format

                const formattedRecipes = recipes.map(recipe => {
                    // Store recipe data
                    const recipeId = 'recipe_' + Math.random().toString(36).substr(2, 9);
                    const recipeData = parseRecipe(recipe);
                    sessionStorage.setItem(recipeId, JSON.stringify(recipeData));
                    
                    // Format recipe HTML
                    return `
                        <div class="recipe-card" data-recipe-id="${recipeId}" style="cursor: pointer;">
                            <div class="recipe-card-header">
                                <h3>${recipeData.name}</h3>
                            </div>
                            <div class="recipe-card-content">
                                ${recipeData.description ? `
                                    <div class="recipe-section">
                                        <div class="recipe-section-title">Description</div>
                                        <div class="recipe-description">${recipeData.description}</div>
                                    </div>
                                ` : ''}

                                ${recipeData.ingredients.length > 0 ? `
                                    <div class="recipe-section">
                                        <div class="recipe-section-title">Ingredients</div>
                                        <div class="recipe-ingredients">
                                            ${recipeData.ingredients.map(ing => `<span class="recipe-ingredient-tag">${ing}</span>`).join('')}
                                        </div>
                                    </div>
                                ` : ''}

                                <div class="recipe-section">
                                    <div class="recipe-section-title">Recipe Details</div>
                                    <div class="recipe-meta">
                                        ${recipeData.difficulty ? `
                                            <div class="recipe-meta-item">
                                                <span class="recipe-meta-label">Difficulty:</span>
                                                <span>${recipeData.difficulty}</span>
                                            </div>
                                        ` : ''}
                                        ${recipeData.cookingTime ? `
                                            <div class="recipe-meta-item">
                                                <span class="recipe-meta-label">Time:</span>
                                                <span>${recipeData.cookingTime}</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Display the formatted recipes
                document.getElementById('suggestionResults').style.display = 'block';
                document.getElementById('suggestionContent').innerHTML = formattedRecipes;

                // Add click handlers to recipe cards
                document.querySelectorAll('.recipe-card').forEach(card => {
                    card.addEventListener('click', function() {
                        const recipeId = this.dataset.recipeId;
                        const recipeData = JSON.parse(sessionStorage.getItem(recipeId));
                        if (recipeData) {
                            // Store the recipe data again to ensure it's fresh
                            sessionStorage.setItem(recipeId, JSON.stringify(recipeData));
                            // Redirect to ingredients page instead of cooking page
                            window.location.href = `/recipe/ingredients/${recipeId}`;
                        }
                    });
                });
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while processing the request');
        }
    });
}

function parseRecipe(recipeText) {
    try {
        // Clean up the text first
        recipeText = recipeText.trim();
        
        // Get the first line which should be the recipe name
        const lines = recipeText.split('\n').map(line => line.trim()).filter(line => line);
        const name = lines[0].replace(/\*\*/g, '').trim();
        
        // Initialize variables
        let description = '';
        let ingredients = [];
        let difficulty = '';
        let cookingTime = '';
        let instructions = [];
        let nutrition = '';

        // Process each section
        let currentSection = '';

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('**Brief description:**')) {
                description = line.split('**Brief description:**')[1].trim();
            }
            else if (line.includes('**Key ingredients needed:**')) {
                const ingredientsText = line.split('**Key ingredients needed:**')[1].trim();
                ingredients = ingredientsText.split(',')
                    .map(i => i.trim())
                    .filter(i => i.length > 0);
            }
            else if (line.includes('**Difficulty level:**')) {
                difficulty = line.split('**Difficulty level:**')[1].trim();
            }
            else if (line.includes('**Cooking time:**')) {
                cookingTime = line.split('**Cooking time:**')[1].trim();
            }
            else if (line.includes('**Step-by-step instructions:**')) {
                currentSection = 'instructions';
                while (++i < lines.length) {
                    const nextLine = lines[i];
                    if (nextLine.includes('**')) break;
                    if (/^\d+\./.test(nextLine)) {
                        instructions.push(nextLine.replace(/^\d+\.\s*/, '').trim());
                    }
                }
                i--; // Back up one line since we'll increment in the loop
            }
            else if (line.includes('**Nutritional information')) {
                const nutritionText = line.split('**Nutritional information')[1]
                    .replace(/\(.*?\)/, '')
                    .replace(/^[^:]*:/, '')
                    .trim();
                nutrition = nutritionText;
            }
        }

        // Parse nutrition information into separate components
        const nutritionItems = nutrition.split(',')
            .map(item => {
                const parts = item.split(':').map(s => s.trim());
                return {
                    label: parts[0],
                    value: parts[1] || ''
                };
            })
            .filter(item => item.label && item.value);

        return {
            name: name || 'Recipe',
            description,
            ingredients,
            difficulty,
            cookingTime,
            instructions,
            nutrition: nutritionItems
        };
    } catch (error) {
        console.error('Error parsing recipe:', error);
        console.error('Recipe text:', recipeText);
        return {
            name: 'Recipe',
            description: 'Error parsing recipe. Please try again.',
            ingredients: [],
            difficulty: '',
            cookingTime: '',
            instructions: [],
            nutrition: []
        };
    }
}

function formatRecipe(recipeText) {
    try {
        const recipeData = parseRecipe(recipeText);
        const recipeId = 'recipe_' + Math.random().toString(36).substr(2, 9);
        
        // Store recipe data for later use
        sessionStorage.setItem(recipeId, JSON.stringify(recipeData));
        
        return `
            <div class="recipe-card" data-recipe-id="${recipeId}" style="cursor: pointer;">
                <div class="recipe-card-header">
                    <h3>${recipeData.name}</h3>
                </div>
                <div class="recipe-card-content">
                    ${recipeData.description ? `
                        <div class="recipe-section">
                            <div class="recipe-description">${recipeData.description}</div>
                        </div>
                    ` : ''}

                    ${recipeData.ingredients.length > 0 ? `
                        <div class="recipe-section">
                            <div class="recipe-section-title">Ingredients</div>
                            <div class="recipe-ingredients">
                                ${recipeData.ingredients.map(ing => `<span class="recipe-ingredient-tag">${ing}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div class="recipe-section">
                        <div class="recipe-meta">
                            ${recipeData.difficulty ? `
                                <div class="recipe-meta-item">
                                    <span class="recipe-meta-label">Difficulty:</span>
                                    <span>${recipeData.difficulty}</span>
                                </div>
                            ` : ''}
                            ${recipeData.cookingTime ? `
                                <div class="recipe-meta-item">
                                    <span class="recipe-meta-label">Time:</span>
                                    <span>${recipeData.cookingTime}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error formatting recipe:', error);
        console.error('Recipe text:', recipeText);
        return `
            <div class="recipe-card">
                <div class="recipe-card-header">
                    <h3>Recipe</h3>
                </div>
                <div class="recipe-card-content">
                    <div class="recipe-section">
                        <div class="recipe-description">Error formatting recipe. Please try again.</div>
                    </div>
                </div>
            </div>
        `;
    }
}
