const year = document.getElementById('year');

if (year) {
  year.textContent = new Date().getFullYear();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, function replaceChar(char) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char];
  });
}

function mediaMarkup(product) {
  const screenshots = Array.isArray(product.screenshots) ? product.screenshots.filter((item) => item && (item.src || item.url)) : [];
  const videos = Array.isArray(product.videos) ? product.videos.filter((item) => item && (item.src || item.url)) : [];
  const items = screenshots.slice(0, 2).map((item) => ({
    type: 'image',
    title: item.title || product.name,
    src: item.src || item.url,
  })).concat(videos.slice(0, 1).map((item) => ({
    type: 'video',
    title: item.title || product.name,
    src: item.src || item.url,
  })));

  if (!items.length) return '';
  return '<div class="media-strip">' + items.map((item) => {
    if (item.type === 'video') {
      return '<video controls muted playsinline src="' + escapeHtml(item.src) + '" title="' + escapeHtml(item.title) + '"></video>';
    }
    return '<img src="' + escapeHtml(item.src) + '" alt="' + escapeHtml(item.title) + '" loading="lazy">';
  }).join('') + '</div>';
}

async function hydratePortfolioProducts() {
  const cards = Array.from(document.querySelectorAll('[data-product-card]'));
  if (!cards.length) return;

  try {
    const response = await fetch('/api/portfolio/content');
    const payload = await response.json();
    if (!response.ok || !payload.success) return;
    const products = new Map((payload.content?.products || []).map((product) => [product.id, product]));

    cards.forEach((card) => {
      const product = products.get(card.dataset.productCard);
      if (!product) return;
      const title = card.querySelector('h3');
      const description = card.querySelector('p');
      const media = card.querySelector('[data-product-media]');
      if (title && product.name) title.textContent = product.name;
      if (description && product.description) description.textContent = product.description;
      if (media) media.innerHTML = mediaMarkup(product);
    });
  } catch (error) {
    // Static content remains available if the portfolio API is temporarily unavailable.
  }
}

hydratePortfolioProducts();
