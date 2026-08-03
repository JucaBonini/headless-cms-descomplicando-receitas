export interface WPPost {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  featured_media: number;
  categories: number[];
  _embedded?: {
    author?: Array<{ name: string }>;
    'wp:featuredmedia'?: Array<{
      source_url: string;
      media_details?: {
        sizes?: {
          [key: string]: {
            source_url: string;
          };
        };
      };
    }>;
    'wp:term'?: Array<Array<{
      id: number;
      name: string;
      slug: string;
      taxonomy: string;
    }>>;
  };
}

export interface WPCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  description?: string;
}

const PRIMARY_WP_URL = 'https://admin.descomplicandoreceitas.com.br';
const FALLBACK_WP_URL = 'https://descomplicandoreceitas.com.br';
let WP_URL = PRIMARY_WP_URL;

export async function getCategories(): Promise<WPCategory[]> {
  try {
    let res = await fetch(`${WP_URL}/wp-json/wp/v2/categories?per_page=100`);
    if (!res.ok && WP_URL !== FALLBACK_WP_URL) {
      WP_URL = FALLBACK_WP_URL;
      res = await fetch(`${WP_URL}/wp-json/wp/v2/categories?per_page=100`);
    }
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const categories = (await res.json()) as WPCategory[];
    // Filtra apenas categorias que têm posts
    return categories.filter(c => c.count > 0);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  try {
    const categories = await getCategories();
    return categories.find(c => c.slug === slug) || null;
  } catch (error) {
    console.error(`Error fetching category by slug ${slug}:`, error);
    return null;
  }
}

export async function getPosts(options: { categoryId?: number; limit?: number; search?: string } = {}): Promise<WPPost[]> {
  const { categoryId, limit = 100, search } = options;
  let queryParams = `_embed=1&per_page=${limit}`;
  if (categoryId) {
    queryParams += `&categories=${categoryId}`;
  }
  if (search) {
    queryParams += `&search=${encodeURIComponent(search)}`;
  }
  
  try {
    let res = await fetch(`${WP_URL}/wp-json/wp/v2/posts?${queryParams}`);
    if (!res.ok && WP_URL !== FALLBACK_WP_URL) {
      WP_URL = FALLBACK_WP_URL;
      res = await fetch(`${WP_URL}/wp-json/wp/v2/posts?${queryParams}`);
    }
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return (await res.json()) as WPPost[];
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  try {
    let res = await fetch(`${WP_URL}/wp-json/wp/v2/posts?slug=${slug}&_embed=1`);
    if (!res.ok && WP_URL !== FALLBACK_WP_URL) {
      WP_URL = FALLBACK_WP_URL;
      res = await fetch(`${WP_URL}/wp-json/wp/v2/posts?slug=${slug}&_embed=1`);
    }
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const posts = (await res.json()) as WPPost[];
    return posts.length > 0 ? posts[0] : null;
  } catch (error) {
    console.error(`Error fetching post by slug ${slug}:`, error);
    return null;
  }
}

