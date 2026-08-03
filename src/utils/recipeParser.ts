export interface Ingredient {
  originalText: string;
  amount: number | null; // e.g. 2, 0.5
  unit: string;          // e.g. "colher (sopa)", "g"
  name: string;          // e.g. "de azeite de oliva"
}

export interface StructuredRecipe {
  description: string;
  utensils: string[];
  ingredients: Ingredient[];
  instructions: string[];
  prepTime: string | null;
  servings: number | null;
  difficulty: string | null;
  tips: string[];
  nutrition: string[];
}

// Mapeia frações comuns para decimais
const fractionMap: { [key: string]: number } = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 0.33,
  '⅔': 0.67,
  '1/2': 0.5,
  '1/4': 0.25,
  '3/4': 0.75,
};

// Tenta extrair a quantidade e separar o resto do texto
export function parseIngredient(text: string): Ingredient {
  const cleanText = text.replace(/<[^>]*>/g, '').trim(); // Remove tags HTML
  
  let amount: number | null = null;
  let remaining = cleanText;

  // 1. Tenta casar número inteiro/decimal seguido de fração (ex: "1 ½ xícara")
  const intFractionRegex = /^(\d+)\s+([½¼¾⅓⅔])\s*(.*)$/;
  const matchIntFraction = cleanText.match(intFractionRegex);
  
  if (matchIntFraction) {
    const intVal = parseInt(matchIntFraction[1]);
    const fracVal = fractionMap[matchIntFraction[2]] || 0;
    amount = intVal + fracVal;
    remaining = matchIntFraction[3];
  } else {
    // 2. Tenta casar número decimal ou inteiro (ex: "1.5", "1,5", "2") ou apenas a fração
    const singleRegex = /^(\d+[\.,]\d+|\d+|[½¼¾⅓⅔])\s*(.*)$/;
    const matchSingle = cleanText.match(singleRegex);
    
    if (matchSingle) {
      const rawVal = matchSingle[1];
      remaining = matchSingle[2];
      
      if (fractionMap[rawVal] !== undefined) {
        amount = fractionMap[rawVal];
      } else {
        amount = parseFloat(rawVal.replace(',', '.'));
      }
    }
  }

  // 3. Tenta identificar unidades comuns
  const units = [
    'colheres de sopa', 'colher de sopa', 'colheres (sopa)', 'colher (sopa)',
    'colheres de chá', 'colher de chá', 'colheres (chá)', 'colher (chá)',
    'xícaras de chá', 'xícara de chá', 'xícaras (chá)', 'xícara (chá)', 'xícaras', 'xícara',
    'dentes de alho', 'dente de alho', 'dentes', 'dente',
    'unidades', 'unidade', 'un',
    'gramas', 'g',
    'mililitros', 'ml',
    'xícaras', 'xícara',
    'filés', 'filé',
    'dentes', 'dente',
    'fatias', 'fatia',
    'pitada', 'pitadas',
    'copo', 'copos',
    'lata', 'latas',
    'caixa', 'caixas',
    'pacote', 'pacotes'
  ];

  let unit = '';
  let name = remaining;

  if (amount !== null) {
    // Procura se a primeira palavra do texto restante é uma unidade conhecida
    for (const u of units) {
      // Escapa caracteres especiais de RegExp como parênteses
      const escapedU = u.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Regex que casa a unidade exatamente no início da string, seguida de espaço/de ou fim de linha
      const unitRegex = new RegExp(`^(${escapedU})(?:\\s+(?:de\\s+)?|\\s*$)(.*)$`, 'i');
      const matchUnit = remaining.match(unitRegex);
      if (matchUnit) {
        unit = matchUnit[1];
        name = matchUnit[2];
        break;
      }
    }
  }

  return {
    originalText: cleanText,
    amount,
    unit,
    name
  };
}

// Extrai itens de uma lista <li> dentro de um trecho HTML
function extractListItems(html: string): string[] {
  const items: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRegex.exec(html)) !== null) {
    // Remove tags HTML internas e limpa espaços
    const cleaned = match[1].replace(/<[^>]*>/g, '').trim();
    if (cleaned) {
      items.push(cleaned);
    }
  }
  return items;
}

// Converte ISO 8601 duration (ex: PT20M) para formato legível (ex: 20 min)
function parseDuration(pt: string | null): string | null {
  if (!pt) return null;
  const match = pt.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return pt;
  const hours = match[1] ? `${match[1]}h` : '';
  const minutes = match[2] ? `${match[2]} min` : '';
  return `${hours} ${minutes}`.trim() || pt;
}

export function parseRecipeHtml(html: string): StructuredRecipe {
  const recipe: StructuredRecipe = {
    description: '',
    utensils: [],
    ingredients: [],
    instructions: [],
    prepTime: null,
    servings: null,
    difficulty: null,
    tips: [],
    nutrition: []
  };

  if (!html) return recipe;

  // Separar o HTML por cabeçalhos (h2, h3, h4)
  const headingRegex = /(<h[234][^>]*>[\s\S]*?<\/h[234]>)/gi;
  const sections = html.split(headingRegex);

  // A primeira parte (antes de qualquer h2/h3/h4) é a descrição inicial
  if (sections[0] && sections[0].trim()) {
    recipe.description = sections[0].replace(/<[^>]*>/g, '').trim();
  }

  // Iterar pelas seções. sections conterá alternadamente: [descrição, cabeçalho1, conteudo1, cabeçalho2, conteudo2...]
  for (let i = 1; i < sections.length; i += 2) {
    const headingHtml = sections[i];
    const contentHtml = sections[i + 1] || '';

    const headingText = headingHtml.replace(/<[^>]*>/g, '').trim().toLowerCase();

    if (headingText.includes('ingrediente')) {
      const items = extractListItems(contentHtml);
      recipe.ingredients = items.map(parseIngredient);
    } else if (headingText.includes('preparo') || headingText.includes('como fazer')) {
      recipe.instructions = extractListItems(contentHtml);
    } else if (headingText.includes('utensílio') || headingText.includes('utensilio')) {
      recipe.utensils = extractListItems(contentHtml);
    } else if (headingText.includes('dica')) {
      recipe.tips = extractListItems(contentHtml);
    } else if (headingText.includes('nutricional') || headingText.includes('nutrição') || headingText.includes('nutricao')) {
      recipe.nutrition = extractListItems(contentHtml);
    } else if (headingText.includes('informações') || headingText.includes('informacoes')) {
      const items = extractListItems(contentHtml);
      items.forEach(item => {
        const lowerItem = item.toLowerCase();
        if (lowerItem.includes('tempo de preparo') || lowerItem.includes('preparo')) {
          recipe.prepTime = item.split(':').pop()?.trim() || null;
        } else if (lowerItem.includes('rendimento') || lowerItem.includes('porções') || lowerItem.includes('porcoes')) {
          const val = item.split(':').pop()?.trim() || '';
          recipe.servings = parseInt(val.replace(/\D/g, '')) || null;
        } else if (lowerItem.includes('dificuldade')) {
          recipe.difficulty = item.split(':').pop()?.trim() || null;
        }
      });
    } else {
      // Se não for um cabeçalho conhecido e ainda não tivermos uma descrição longa, adiciona à descrição
      if (!recipe.description && contentHtml) {
        recipe.description = contentHtml.replace(/<[^>]*>/g, '').trim();
      }
    }
  }

  // Caso não tenha encontrado informações estruturadas (ex: posts antigos),
  // a descrição é o HTML inteiro limpo e as listas vazias
  if (recipe.ingredients.length === 0 && recipe.instructions.length === 0) {
    recipe.description = html.replace(/<[^>]*>/g, '').substring(0, 300) + '...';
  }

  return recipe;
}

// Fallback Scraper: Extrai os dados do HTML público do WordPress (utiliza JSON-LD ou seletores CSS)
export function parsePublicHtml(html: string): StructuredRecipe {
  const recipe: StructuredRecipe = {
    description: '',
    utensils: [],
    ingredients: [],
    instructions: [],
    prepTime: '15 min',
    servings: 2,
    difficulty: 'Fácil',
    tips: [],
    nutrition: []
  };

  if (!html) return recipe;

  // 1. TENTA EXTRAIR DO SCHEMA JSON-LD (Mais confiável)
  const jsonLdRegex = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let parsedFromSchema = false;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const graph = parsed['@graph'] || (Array.isArray(parsed) ? parsed : [parsed]);
      const recipeObj = graph.find((item: any) => item['@type'] === 'Recipe');

      if (recipeObj) {
        recipe.description = recipeObj.description || '';
        recipe.prepTime = parseDuration(recipeObj.prepTime) || recipe.prepTime;
        
        if (recipeObj.recipeYield) {
          const yieldVal = Array.isArray(recipeObj.recipeYield) ? recipeObj.recipeYield[0] : recipeObj.recipeYield;
          recipe.servings = parseInt(yieldVal.toString().replace(/\D/g, '')) || 2;
        }
        
        if (recipeObj.recipeIngredient) {
          recipe.ingredients = recipeObj.recipeIngredient.map((ing: string) => parseIngredient(ing));
        }

        if (recipeObj.recipeInstructions) {
          const steps = recipeObj.recipeInstructions;
          recipe.instructions = steps.map((s: any) => {
            if (typeof s === 'string') return s.trim();
            if (s.text) return s.text.trim();
            return '';
          }).filter((s: string) => s !== '');
        }
        parsedFromSchema = true;
        break;
      }
    } catch (e) {
      // Ignorar erros de parse para blocos JSON-LD mal formatados
    }
  }

  // 2. SCRAPING MANUAL HTML (Se falhar ou não achar JSON-LD)
  if (!parsedFromSchema) {
    console.log('JSON-LD Recipe não encontrado. Efetuando scraping HTML manual...');
    
    const descMatch = html.match(/<meta name="description" content="([^"]*)"/i);
    if (descMatch) {
      recipe.description = descMatch[1];
    }

    // Ingredientes (id="ingredients")
    const ingredientsSection = html.match(/id="ingredients"[\s\S]*?<\/section>/i);
    if (ingredientsSection) {
      const sectionHtml = ingredientsSection[0];
      const ingRegex = /<span class="text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">([\s\S]*?)<\/span>/gi;
      let matchIng;
      const ingTexts: string[] = [];
      while ((matchIng = ingRegex.exec(sectionHtml)) !== null) {
        ingTexts.push(matchIng[1].trim());
      }
      recipe.ingredients = ingTexts.map(parseIngredient);
    }

    // Modo de preparo (id="instructions")
    const instructionsSection = html.match(/id="instructions"[\s\S]*?<\/section>/i);
    if (instructionsSection) {
      const sectionHtml = instructionsSection[0];
      const stepRegex = /<div class="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">([\s\S]*?)<\/div>/gi;
      let matchStep;
      while ((matchStep = stepRegex.exec(sectionHtml)) !== null) {
        recipe.instructions.push(matchStep[1].trim());
      }
    }
  }

  return recipe;
}
