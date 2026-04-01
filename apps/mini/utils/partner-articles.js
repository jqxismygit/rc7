/**
 * 将话题下的文章映射为「合作伙伴」卡片数据（封面→logo，标题→名称）。
 * @param {Array<{ id: string; title?: string; cover_url?: string | null }>} articles
 */
export function mapArticlesToPartnerBrands(articles) {
  if (!Array.isArray(articles)) return [];
  return articles.map((a) => {
    const name = a.title || "";
    return {
      id: a.id,
      logo: a.cover_url || "",
      name,
      tagline: a.subtitle || "",
    };
  });
}
