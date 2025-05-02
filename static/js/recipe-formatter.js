function formatRecipe(recipeText) {
    try {
        // Clean up the text first
        recipeText = recipeText.trim();
        
        // Extract recipe name - look for text between ** markers after the number
        const nameMatch = recipeText.match(/^\d+\.\s*\*\*(.*?)\*\*/);
        const name = nameMatch ? nameMatch[1].trim() : 'Recipe';
        
        // Initialize variables
        let description = '';
        let ingredients = [];
        let difficulty = '';
        let cookingTime = '';
        let instructions = [];
        let nutrition = '';

        // Process each section
        const lines = recipeText.split('\n').map(line => line.trim()).filter(line => line);
        let currentSection = '';

        for (let i = 0; i < lines.length; i++) {
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
                // Collect all subsequent lines that start with numbers until we hit another section
                while (++i < lines.length) {
                    const nextLine = lines[i];
                    if (nextLine.includes('**')) break; // Hit next section
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

        return `
            <div class="recipe-card">
                <div class="recipe-card-header">
                    ${name}
                </div>
                <div class="recipe-card-content">
                    ${description ? `
                        <div class="recipe-section">
                            <div class="recipe-section-title">Description</div>
                            <div class="recipe-description">${description}</div>
                        </div>
                    ` : ''}

                    ${ingredients.length > 0 ? `
                        <div class="recipe-section">
                            <div class="recipe-section-title">Ingredients</div>
                            <div class="recipe-ingredients">
                                ${ingredients.map(ing => `<span class="recipe-ingredient-tag">${ing}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${(difficulty || cookingTime) ? `
                        <div class="recipe-section">
                            <div class="recipe-section-title">Recipe Details</div>
                            <div class="recipe-meta">
                                ${difficulty ? `
                                    <div class="recipe-meta-item">
                                        <span class="recipe-meta-label">Difficulty:</span>
                                        <span>${difficulty}</span>
                                    </div>
                                ` : ''}
                                ${cookingTime ? `
                                    <div class="recipe-meta-item">
                                        <span class="recipe-meta-label">Time:</span>
                                        <span>${cookingTime}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    ${instructions.length > 0 ? `
                        <div class="recipe-section">
                            <div class="recipe-section-title">Instructions</div>
                            <ol class="recipe-steps">
                                ${instructions.map(step => `<li class="recipe-step">${step}</li>`).join('')}
                            </ol>
                        </div>
                    ` : ''}

                    ${nutritionItems.length > 0 ? `
                        <div class="recipe-section">
                            <div class="recipe-section-title">Nutrition Facts</div>
                            <div class="nutrition-grid">
                                ${nutritionItems.map(({ label, value }) => `
                                    <div class="nutrition-item">
                                        <div class="nutrition-label">${label}</div>
                                        <div class="nutrition-value">${value}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error formatting recipe:', error);
        console.error('Recipe text:', recipeText);
        return `
            <div class="recipe-card">
                <div class="recipe-card-header">Recipe</div>
                <div class="recipe-card-content">
                    <div class="recipe-section">
                        <div class="recipe-description">Error formatting recipe. Please try again.</div>
                    </div>
                </div>
            </div>
        `;
    }
} 